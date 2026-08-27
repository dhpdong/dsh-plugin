/**
 * dsh-session-manager client half: a trash-can icon button in the session
 * header utilities slot. Clicking it toggles an inline panel that lists
 * every persisted session; each row carries a delete icon that permanently
 * removes the session's on-disk directory through the host's
 * /sidebar/api/sessions endpoint and then refreshes the list. The current
 * session's delete button is disabled to prevent breaking the live
 * conversation.
 *
 * Loaded as a CJS factory by DSH's client module loader
 * (window.__ModuleLoader__.load); `require` resolves platform module-table
 * entries only. No build step needed — plain JS.
 */
/* global window, document, fetch, alert, confirm */
window.__ModuleLoader__.load({
  id: 'dsh-session-manager',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    var useState = React.useState
    var useCallback = React.useCallback
    var useEffect = React.useEffect
    var useRef = React.useRef
    var h = React.createElement

    /** POST to /sidebar/api/sessions with { action, ...payload }. */
    function call(action, payload) {
      var body = Object.assign({ action: action }, payload || {})
      return fetch('/sidebar/api/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then(function (r) { return r.json() })
        .then(function (res) {
          if (res.ok) return res.value
          throw new Error(res.error ? res.error.message : 'request failed')
        })
    }

    /** The inline session-list panel rendered inside the header utilities. */
    function SessionListPanel(props) {
      var sessionId = props.sessionId
      var sessionsState = useState([])
      var sessions = sessionsState[0]
      var setSessions = sessionsState[1]
      var errorState = useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      var loadingState = useState(true)
      var loading = loadingState[0]
      var setLoading = loadingState[1]
      var busyState = useState(null)
      var busyId = busyState[0]
      var setBusyId = busyState[1]

      var load = useCallback(function () {
        setLoading(true)
        setError(null)
        call('list')
          .then(function (list) { setSessions(list); setLoading(false) })
          .catch(function (err) { setError(err.message); setLoading(false) })
      }, [])
      useEffect(function () { load() }, [load])

      var doDelete = useCallback(function (id) {
        var session = sessions.find(function (s) { return s.id === id })
        var label = (session && session.title) || id
        if (!confirm('删除会话「' + label + '」？记录将从磁盘移除，不可恢复。')) return
        setBusyId(id)
        call('purge', { sessionId: id })
          .then(function () { setSessions(sessions.filter(function (s) { return s.id !== id })); setBusyId(null) })
          .catch(function (err) { setBusyId(null); alert(err.message) })
      }, [sessions])

      var headerStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #2a2a32' }
      var titleStyle = { fontSize: '13px', fontWeight: '600', color: '#ccc' }
      var rowStyle = { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderBottom: '1px solid #222', minHeight: '36px' }
      var infoStyle = { flex: '1', minWidth: '0' }
      var titleTextStyle = { fontSize: '13px', color: '#eee', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
      var pathStyle = { fontSize: '11px', color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
      var errorStyle = { padding: '8px 12px', fontSize: '12px', color: '#f2a1a1' }
      var hintStyle = { padding: '8px 12px', fontSize: '12px', color: '#777' }

      var children = []
      children.push(
        h('div', { key: 'h', style: headerStyle },
          h('span', { style: titleStyle }, '会话管理'),
          h('button', {
            type: 'button', onClick: load,
            style: { background: 'none', border: 'none', cursor: 'pointer', color: '#999' },
            title: '刷新',
          }, '↻')
        )
      )
      if (error) children.push(h('div', { key: 'err', style: errorStyle }, error))
      if (loading) {
        children.push(h('div', { key: 'ld', style: hintStyle }, '加载中…'))
      } else if (sessions.length === 0) {
        children.push(h('div', { key: 'em', style: hintStyle }, '没有持久化会话'))
      } else {
        for (var i = 0; i < sessions.length; i++) {
          ;(function (session) {
            var isCurrent = session.id === sessionId
            var busy = busyId === session.id
            var label = session.title || session.id
            children.push(
              h('div', { key: session.id, style: rowStyle },
                h('div', { style: infoStyle },
                  h('div', { style: titleTextStyle, title: label }, label),
                  session.cwd ? h('div', { style: pathStyle, title: session.cwd }, session.cwd) : null
                ),
                isCurrent
                  ? h('span', { style: { fontSize: '11px', color: '#888', flexShrink: '0' } }, '当前会话')
                  : h('button', {
                      type: 'button', disabled: busy,
                      style: {
                        background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer',
                        color: busy ? '#555' : '#f2a1a1', padding: '4px', flexShrink: '0',
                      },
                      title: '彻底删除',
                      onClick: function () { doDelete(session.id) },
                    }, '🗑️')
              )
            )
          })(sessions[i])
        }
      }

      return h('div', {
        style: {
          position: 'absolute', top: '100%', right: '0', marginTop: '4px',
          width: '360px', maxHeight: '420px', overflowY: 'auto',
          background: '#1a1a22', border: '1px solid #333',
          borderRadius: '8px', zIndex: '2147483000',
          boxShadow: '0 8px 30px rgba(0,0,0,.5)',
        },
      }, children)
    }

    /** The header utility button + toggled session list panel. */
    function SessionManagerButton(props) {
      var sessionId = props.sessionId
      var openState = useState(false)
      var open = openState[0]
      var setOpen = openState[1]
      var containerRef = useRef(null)

      useEffect(function () {
        if (!open) return
        function handle(e) { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handle)
        return function () { document.removeEventListener('mousedown', handle) }
      }, [open])

      return h('div', { ref: containerRef, style: { position: 'relative', display: 'inline-flex' } },
        h('button', {
          type: 'button', 'aria-label': '会话管理', title: '会话管理',
          style: {
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '4px', color: '#999',
          },
          onClick: function () { setOpen(!open) },
        }, '🗑️'),
        open ? h(SessionListPanel, { sessionId: sessionId }) : null
      )
    }

    // The client cordis runner waits for the declared services, then calls
    // apply(ctx); the slot registration runs on the CONTEXT's slots service
    // (ctx.slots), not the raw ui-slots module. The framework session kit
    // provides `sessionId` to the registered component automatically.
    exports.inject = ['slots']
    exports.apply = function (ctx) {
      ctx.slots.inject('conversation.session.header.utilities', function () {
        return ctx.slots.register({
          name: 'conversation.session.header.utilities',
          id: 'session-manager',
          order: 900,
        }, SessionManagerButton)
      })
    }
    return module.exports
  },
})
