/**
 * dsh-native-file-ops client half.
 *
 * Enhances the NATIVE right-Sidebar file tree in place — no replacement tab
 * body, no second sidebar. Rows already carry `data-files-path` (workspace
 * relative) and `data-files-entry` (file/directory/other); this plugin adds:
 *
 *   - a context menu: new file/folder, rename, download, move to trash,
 *     copy relative path, copy absolute path;
 *   - `draggable` rows and drop-on-folder (or drop-on-tree-root) move;
 *   - an inline rename / create dialog.
 *
 * All mutations go through the fenced host route of the same package; the
 * native tree's file watch (or its reload control as a fallback) refreshes the
 * list afterwards.
 */
/* global window, document, navigator, fetch, MouseEvent, DragEvent, KeyboardEvent */
window.__ModuleLoader__.load({
  id: 'dsh-native-file-ops',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var CSS = `
.nfo-menu{position:fixed;z-index:2147483000;min-width:200px;padding:4px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#1e1e24);box-shadow:0 8px 30px rgba(0,0,0,.45);font:13px/1.5 system-ui,sans-serif;color:var(--dsw-alias-label-primary,#eee)}
.nfo-menu button{display:flex;width:100%;align-items:center;gap:8px;padding:6px 8px;border:0;border-radius:5px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:nowrap}
.nfo-menu button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.nfo-menu button.nfo-danger{color:var(--dsw-alias-state-error-primary,#f2a1a1)}
.nfo-menu hr{margin:4px 2px;border:0;border-top:1px solid var(--dsw-alias-border-l1,#333)}
.nfo-drop{outline:1px dashed var(--dsw-alias-button-info-fill,#4a7dff);outline-offset:-2px;background:rgba(74,125,255,.12)!important}
.nfo-overlay{position:fixed;inset:0;z-index:2147483100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}
.nfo-dialog{width:min(380px,90vw);padding:18px;border:1px solid var(--dsw-alias-border-l1,#333);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#18181d);box-shadow:0 20px 60px rgba(0,0,0,.5);font:13px/1.5 system-ui,sans-serif;color:var(--dsw-alias-label-primary,#eee)}
.nfo-dialog h3{margin:0 0 12px;font-size:15px;font-weight:600}
.nfo-dialog input{box-sizing:border-box;width:100%;height:34px;padding:0 10px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:inherit;font:inherit;outline:none}
.nfo-dialog input:focus{border-color:var(--dsw-alias-button-info-fill,#4a7dff)}
.nfo-dialog .nfo-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}
.nfo-dialog button{height:30px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.nfo-dialog button.nfo-primary{border-color:transparent;background:var(--dsw-alias-button-info-fill,#4a7dff);color:#fff}
`
    var locale = 'en'
    var isZh = function () { return String(locale).toLowerCase().indexOf('zh') === 0 }
    var L = function (zh, en) { return isZh() ? zh : en }
    var MENU_ID = 'dfo-menu'

    function ctxState(ctx) {
      var list = ctx.sessions.list.getSnapshot()
      var id
      // uiSession publishes the on-screen Session binding; retainedBy.mainView
      // alone is ambiguous (several Sessions can stay retained), which made
      // operations resolve against the wrong workspace.
      try {
        var binding = ctx.uiSession && ctx.uiSession.adapter && ctx.uiSession.adapter.current
          ? ctx.uiSession.adapter.current.getSnapshot()
          : undefined
        if (binding && typeof binding.key === 'string' && binding.key !== '') id = binding.key
      } catch (error) { /* fall through */ }
      if (id === undefined) {
        for (var i = 0; i < list.ids.length; i += 1) {
          var row = list.byId[list.ids[i]]
          if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) { id = list.ids[i]; break }
        }
      }
      if (id === undefined) return undefined
      var summary = list.byId[id]
      return { sessionId: id, cwd: summary && summary.cwd }
    }

    /** POST one sidebar-lite /sidebar/api method (the LAN-authenticated carrier). */
    function sidebarCall(ctx, method, payload) {
      var state = ctxState(ctx)
      if (state === undefined) return Promise.reject(new Error(L('没有活动会话', 'no active session')))
      var body = Object.assign({ sessionId: state.sessionId, cwd: state.cwd }, payload)
      return fetch('/sidebar/api/' + method, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then(function (response) {
        return response.json().then(function (result) {
          if (!response.ok || !result.ok) throw new Error(result.error ? result.error.message : 'request failed')
          return result.value
        })
      })
    }

    /** Download through the sidebar's binary-safe media route. */
    function sidebarDownload(ctx, path, isDir) {
      var state = ctxState(ctx)
      if (state === undefined) { toast(L('没有活动会话', 'no active session')); return }
      var query = new URLSearchParams({ sessionId: state.sessionId, path: path, download: '1' })
      if (state.cwd) query.set('cwd', state.cwd)
      var anchor = document.createElement('a')
      anchor.href = '/sidebar/file?' + query.toString()
      var name = path.split('/').pop() || 'download'
      anchor.download = isDir ? name + '.zip' : name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    }

    function toast(message) {
      var node = document.createElement('div')
      node.textContent = message
      node.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483200;padding:8px 14px;border-radius:8px;background:rgba(30,30,36,.96);border:1px solid #444;color:#eee;font:13px system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.4)'
      document.body.appendChild(node)
      window.setTimeout(function () { node.remove() }, 1800)
    }

    function refreshTree() {
      window.setTimeout(function () {
        var button = document.querySelector('[data-files-reload]')
        if (button && typeof button.click === 'function') button.click()
      }, 120)
    }

    function closeMenu() {
      var old = document.getElementById(MENU_ID)
      if (old !== null) old.remove()
    }

    function menuItem(label, action, danger) {
      var button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      if (danger) button.className = 'nfo-danger'
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        closeMenu()
        try { action() } catch (error) { toast(String(error && error.message ? error.message : error)) }
      })
      return button
    }

    function openMenu(x, y, row) {
      closeMenu()
      var menu = document.createElement('div')
      menu.id = MENU_ID
      menu.className = 'nfo-menu'
      var entry = row ? row.getAttribute('data-files-entry') : undefined
      var path = row ? row.getAttribute('data-files-path') : ''
      var isDir = entry === 'directory'
      var isFile = entry === 'file'
      var state = ctxState(currentCtx)
      var cwd = state ? state.cwd : ''

      if (!row || isDir) {
        menu.appendChild(menuItem(L('新建文件', 'New file'), function () { openCreate('file', isDir ? path : '') }))
        menu.appendChild(menuItem(L('新建文件夹', 'New folder'), function () { openCreate('folder', isDir ? path : '') }))
        menu.appendChild(document.createElement('hr'))
      }
      if (row && (isFile || isDir)) {
        menu.appendChild(menuItem(L('重命名', 'Rename'), function () { openRename(path) }))
        menu.appendChild(menuItem(isDir ? L('下载文件夹', 'Download folder') : L('下载', 'Download'), function () { downloadFile(path, isDir) }))
        menu.appendChild(menuItem(L('移动到回收站', 'Move to trash'), function () { trashPath(path) }, true))
        menu.appendChild(document.createElement('hr'))
        var absPath = path.charAt(0) === '/' ? path : cwd.replace(/[\\/]+$/, '') + '/' + path
        var root = (cwd || '').replace(/[\\/]+$/, '')
        var relPath = root !== '' && absPath.indexOf(root + '/') === 0 ? absPath.slice(root.length + 1) : absPath
        menu.appendChild(menuItem(L('复制相对地址', 'Copy relative path'), function () { copyText(relPath) }))
        menu.appendChild(menuItem(L('复制绝对地址', 'Copy absolute path'), function () { copyText(absPath) }))
      }
      document.body.appendChild(menu)
      var rect = menu.getBoundingClientRect()
      menu.style.left = Math.max(4, Math.min(x, window.innerWidth - rect.width - 4)) + 'px'
      menu.style.top = Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)) + 'px'
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { toast(L('已复制', 'Copied')) }, function () { toast(text) })
        return
      }
      var area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      try { document.execCommand('copy') } catch (e) { /* ignore */ }
      area.remove()
      toast(L('已复制', 'Copied'))
    }

    function dialog(title, value, placeholder, onConfirm) {
      var overlay = document.createElement('div')
      overlay.className = 'nfo-overlay'
      var box = document.createElement('div')
      box.className = 'nfo-dialog'
      var heading = document.createElement('h3')
      heading.textContent = title
      var input = document.createElement('input')
      input.value = value || ''
      input.placeholder = placeholder || ''
      var actions = document.createElement('div')
      actions.className = 'nfo-actions'
      var cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = L('取消', 'Cancel')
      var confirm = document.createElement('button')
      confirm.type = 'button'
      confirm.className = 'nfo-primary'
      confirm.textContent = L('确定', 'OK')
      var close = function () { overlay.remove() }
      cancel.addEventListener('click', close)
      confirm.addEventListener('click', function () {
        var next = input.value.trim()
        if (next === '') return
        close()
        Promise.resolve(onConfirm(next)).catch(function (error) { toast(String(error && error.message ? error.message : error)) })
      })
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') confirm.click()
        if (event.key === 'Escape') close()
      })
      actions.appendChild(cancel)
      actions.appendChild(confirm)
      box.appendChild(heading)
      box.appendChild(input)
      box.appendChild(actions)
      overlay.appendChild(box)
      overlay.addEventListener('mousedown', function (event) { if (event.target === overlay) close() })
      document.body.appendChild(overlay)
      window.setTimeout(function () { input.focus(); input.select() }, 0)
    }

    function openCreate(kind, dir) {
      dialog(
        kind === 'folder' ? L('新建文件夹', 'New folder') : L('新建文件', 'New file'),
        '',
        kind === 'folder' ? L('文件夹名称', 'Folder name') : L('文件名', 'File name'),
        function (name) {
          return sidebarCall(currentCtx, 'fs.create', { dir: dir, name: name, kind: kind === 'folder' ? 'directory' : 'file' }).then(function () {
            toast(L('已创建', 'Created'))
            refreshTree()
          })
        },
      )
    }

    function openRename(path) {
      var name = path.split('/').pop()
      dialog(L('重命名', 'Rename'), name, name, function (next) {
        return sidebarCall(currentCtx, 'fs.rename', { path: path, newName: next }).then(function () {
          toast(L('已重命名', 'Renamed'))
          refreshTree()
        })
      })
    }

    function trashPath(path) {
      if (!window.confirm(L('删除「' + path + '」？将移入系统回收站。', 'Delete "' + path + '"? It will be moved to the OS trash.'))) return
      sidebarCall(currentCtx, 'fs.trash', { path: path }).then(function () {
        toast(L('已删除', 'Deleted'))
        refreshTree()
      }).catch(function (error) { toast(String(error && error.message ? error.message : error)) })
    }

    /**
     * Folder download via the File System Access API: the user picks a parent
     * directory, the tree is recreated under it, and each file is fetched from
     * the sidebar media route and written directly to disk. No zip. Browsers
     * without the API fall back to the zip stream.
     */
    function downloadFolder(path) {
      if (typeof window.showDirectoryPicker !== 'function') {
        sidebarDownload(currentCtx, path, true)
        return
      }
      var state = ctxState(currentCtx)
      if (state === undefined) { toast(L('没有活动会话', 'no active session')); return }
      var name = path.split('/').filter(Boolean).pop() || 'folder'
      window.showDirectoryPicker({ mode: 'readwrite' }).then(function (parent) {
        return sidebarCall(currentCtx, 'fs.manifest', { path: path }).then(function (manifest) {
          return parent.getDirectoryHandle(name, { create: true }).then(function (root) {
            var dirs = manifest.entries.filter(function (e) { return e.type === 'directory' })
            var files = manifest.entries.filter(function (e) { return e.type === 'file' })
            var status = document.createElement('div')
            status.textContent = L('正在下载文件夹…', 'Downloading folder…')
            status.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483200;padding:8px 14px;border-radius:8px;background:rgba(30,30,36,.96);border:1px solid #444;color:#eee;font:13px system-ui,sans-serif'
            document.body.appendChild(status)
            var ensureDir = function (rel) {
              var parts = rel.split('/')
              return parts.reduce(function (p, part) {
                return p.then(function (handle) { return handle.getDirectoryHandle(part, { create: true }) })
              }, Promise.resolve(root))
            }
            var chain = Promise.resolve()
            dirs.forEach(function (entry) { chain = chain.then(function () { return ensureDir(entry.path) }) })
            return chain.then(function () {
              var done = 0
              var next = 0
              var fetchOne = function (entry) {
                var query = new URLSearchParams({ sessionId: state.sessionId, path: path.replace(/\/+$/, '') + '/' + entry.path, download: '1' })
                if (state.cwd) query.set('cwd', state.cwd)
                return fetch('/sidebar/file?' + query.toString()).then(function (response) {
                  if (!response.ok) throw new Error('download failed: ' + response.status)
                  return response.blob()
                }).then(function (blob) {
                  var parts = entry.path.split('/')
                  var file = parts.pop()
                  return parts.reduce(function (p, part) {
                    return p.then(function (handle) { return handle.getDirectoryHandle(part, { create: true }) })
                  }, Promise.resolve(root)).then(function (handle) {
                    return handle.getFileHandle(file, { create: true })
                  }).then(function (handle) { return handle.createWritable() }).then(function (writable) {
                    return writable.write(blob).then(function () { return writable.close() })
                  })
                }).then(function () {
                  done += 1
                  if (done % 10 === 0 || done === files.length) status.textContent = L('正在下载文件夹… ' + done + '/' + files.length, 'Downloading folder… ' + done + '/' + files.length)
                })
              }
              var worker = function () {
                if (next >= files.length) return Promise.resolve()
                var entry = files[next++]
                return fetchOne(entry).then(worker)
              }
              return Promise.all([worker(), worker(), worker(), worker()])
            }).then(function () {
              status.remove()
              toast(L('文件夹下载完成', 'Folder downloaded'))
            }, function (error) {
              status.remove()
              toast(String(error && error.message ? error.message : error))
            })
          })
        })
      }).catch(function (error) {
        if (error && error.name === 'AbortError') return
        toast(String(error && error.message ? error.message : error))
      })
    }

    function downloadFile(path, isDir) {
      if (isDir === true) { downloadFolder(path); return }
      sidebarDownload(currentCtx, path, false)
    }

    var currentCtx
    var draggingPath = null

    function rowOf(target) {
      return target && target.closest ? target.closest('[data-files-path]') : null
    }

    function onContextMenu(event) {
      var row = rowOf(event.target)
      if (row === null) {
        if (!event.target.closest || event.target.closest('[data-files-state="tree"]') === null) return
      }
      event.preventDefault()
      event.stopPropagation()
      openMenu(event.clientX, event.clientY, row)
    }

    function onDragStart(event) {
      var row = rowOf(event.target)
      if (row === null) return
      draggingPath = row.getAttribute('data-files-path')
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', draggingPath)
      }
    }

    function onDragOver(event) {
      if (draggingPath === null) return
      var row = rowOf(event.target)
      var body = event.target.closest ? event.target.closest('[data-files-body]') : null
      if (row === null && body === null) return
      if (row !== null && row.getAttribute('data-files-entry') !== 'directory') return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
      if (row !== null) row.classList.add('nfo-drop')
    }

    function onDragLeave(event) {
      var row = rowOf(event.target)
      if (row !== null) row.classList.remove('nfo-drop')
    }

    function onDrop(event) {
      if (draggingPath === null) return
      var row = rowOf(event.target)
      var body = event.target.closest ? event.target.closest('[data-files-body]') : null
      if (row === null && body === null) return
      if (row !== null && row.getAttribute('data-files-entry') !== 'directory') return
      event.preventDefault()
      event.stopPropagation()
      var from = draggingPath
      var toDir = row !== null ? row.getAttribute('data-files-path') : ''
      if (row !== null) row.classList.remove('nfo-drop')
      draggingPath = null
      if (from === toDir || (toDir !== '' && toDir.indexOf(from + '/') === 0)) return
      sidebarCall(currentCtx, 'fs.move', { from: from, toDir: toDir }).then(function () {
        toast(L('已移动', 'Moved'))
        refreshTree()
      }).catch(function (error) { toast(String(error && error.message ? error.message : error)) })
    }

    function onDragEnd() {
      draggingPath = null
      var marked = document.querySelectorAll('.nfo-drop')
      for (var i = 0; i < marked.length; i += 1) marked[i].classList.remove('nfo-drop')
    }

    function markDraggable() {
      var rows = document.querySelectorAll('[data-files-path]')
      for (var i = 0; i < rows.length; i += 1) {
        if (rows[i].getAttribute('draggable') !== 'true') rows[i].setAttribute('draggable', 'true')
      }
    }


    exports.inject = ['sessions', 'locale', 'uiSession']
    exports.apply = function (ctx) {
      currentCtx = ctx
      try { locale = ctx.locale.getSnapshot().active || 'en' } catch (error) { locale = 'en' }
      try { ctx.locale.subscribe(function () { try { locale = ctx.locale.getSnapshot().active || locale } catch (error) { /* ignore */ } }) } catch (error) { /* ignore */ }
      var style = document.createElement('style')
      style.dataset.plugin = 'dsh-native-file-ops'
      style.textContent = CSS
      document.head.appendChild(style)
      var observer = new MutationObserver(function () { markDraggable() })
      observer.observe(document.body, { childList: true, subtree: true })
      markDraggable()
      document.addEventListener('contextmenu', onContextMenu, true)
      document.addEventListener('dragstart', onDragStart, true)
      document.addEventListener('dragover', onDragOver, true)
      document.addEventListener('dragleave', onDragLeave, true)
      document.addEventListener('drop', onDrop, true)
      document.addEventListener('dragend', onDragEnd, true)
      document.addEventListener('mousedown', function (event) {
        if (event.target.closest && event.target.closest('#dfo-menu') === null) closeMenu()
      }, true)
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeMenu()
      }, true)
      ctx.effect(function () {
        return function () {
          observer.disconnect()
          document.removeEventListener('contextmenu', onContextMenu, true)
          document.removeEventListener('dragstart', onDragStart, true)
          document.removeEventListener('dragover', onDragOver, true)
          document.removeEventListener('dragleave', onDragLeave, true)
          document.removeEventListener('drop', onDrop, true)
          document.removeEventListener('dragend', onDragEnd, true)
          closeMenu()
        }
      })
    }
    return module.exports
  },
})
