/**
 * dsh-inline-diff client half: takes over the `edit` / `write` tool rows in
 * the conversation so the applied diff renders INLINE AND ALWAYS EXPANDED
 * (Claude Code style) instead of the stock collapsed-by-default card.
 *
 * Registers into the keyed `tool.call.toolview` slot (dispatched by wire tool
 * name; an unclaimed key keeps the stock generic row, so only these two rows
 * change). The diff extraction mirrors dsh-client-ui-tool's diffCardModel:
 * running calls read `callView.diffs`, settled results read `resultView.diffs`
 * (authoritative), and DiffBlock from dsh-client-ui-primitives renders the
 * hunks with its own chrome.
 *
 * Loaded as a CJS factory by DSH's client module loader; no build step.
 */
/* global window */
window.__ModuleLoader__.load({
  id: 'dsh-inline-diff',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var slots = require('@deepseek-ai/dsh-client-ui-slots')
    var primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    var DiffBlock = primitives.DiffBlock
    var h = React.createElement

    /** Validate an untrusted diffs array into { path, oldText, newText } hunks. */
    function narrowDiffs(diffs) {
      if (!Array.isArray(diffs) || diffs.length === 0) return null
      var out = []
      for (var i = 0; i < diffs.length; i++) {
        var hunk = diffs[i]
        if (typeof hunk !== 'object' || hunk === null) return null
        if (typeof hunk.path !== 'string') return null
        if (hunk.oldText !== null && typeof hunk.oldText !== 'string') return null
        if (typeof hunk.newText !== 'string') return null
        out.push({ path: hunk.path, oldText: hunk.oldText, newText: hunk.newText })
      }
      return out
    }

    /**
     * Derive one hunk from the call arguments (0.2 toolview blocks carry
     * `argsRaw`; the old `callView` presentation object is gone). Write shows
     * the whole file as an addition; edit shows the literal replacement.
     */
    function diffOfArgs(block, toolName) {
      var raw = typeof block.argsRaw === 'string'
        ? block.argsRaw
        : block.call && typeof block.call.argsRaw === 'string' ? block.call.argsRaw : null
      if (raw === null) return null
      var args
      try { args = JSON.parse(raw) } catch (e) { return null }
      if (args === null || typeof args !== 'object') return null
      var path = typeof args.file_path === 'string' ? args.file_path : typeof args.path === 'string' ? args.path : null
      if (path === null) return null
      if (toolName === 'write' && typeof args.content === 'string') {
        return [{ path: path, oldText: null, newText: args.content }]
      }
      if (toolName === 'edit' && typeof args.old_string === 'string' && typeof args.new_string === 'string') {
        return [{ path: path, oldText: args.old_string, newText: args.new_string }]
      }
      return null
    }

    /** Diff-card model off a running/settled block (legacy callView first, then 0.2 meta/args). */
    function diffOf(block, toolName) {
      if (!('kind' in block)) {
        var call = block.callView && block.callView.card === 'diff' ? block.callView : null
        return call !== null ? narrowDiffs(call.diffs) : diffOfArgs(block, toolName)
      }
      var result = block.resultView && block.resultView.card === 'diff' ? block.resultView : null
      if (result !== null) return narrowDiffs(result.diffs)
      if (block.meta !== null && typeof block.meta === 'object') {
        var applied = narrowDiffs(block.meta.diffs)
        if (applied !== null) return applied
      }
      return diffOfArgs(block, toolName)
    }

    /** Best-effort file path from the call's raw JSON arguments. */
    function pathOfArgs(argsRaw) {
      if (typeof argsRaw !== 'string') return null
      try {
        var args = JSON.parse(argsRaw)
        if (typeof args.path === 'string') return args.path
        if (typeof args.file_path === 'string') return args.file_path
        if (typeof args.filePath === 'string') return args.filePath
      } catch { /* not JSON — ignore */ }
      return null
    }

    /** First line of a settled call's text output (error text lands here). */
    function outputLine(block) {
      if (!('kind' in block) || !Array.isArray(block.content)) return null
      var text = ''
      for (var i = 0; i < block.content.length; i++) {
        var part = block.content[i]
        if (part && part.type === 'text' && typeof part.text === 'string') text += part.text + '\n'
      }
      text = text.trim()
      return text === '' ? null : text.split('\n')[0]
    }

    /** The always-expanded inline row for one edit/write call. */
    function InlineDiffRow(props) {
      var block = props.block
      var toolName = props.toolName
      var openFile = props.openFile
      var running = props.phase === 'preparing' || props.phase === 'start' || !('kind' in block)
      var diffs = diffOf(block, toolName)
      var path = diffs !== null ? diffs[0].path : pathOfArgs(block.argsRaw !== undefined ? block.argsRaw : (block.call && block.call.argsRaw))
      var line = outputLine(block)
      var label = toolName === 'write' ? 'Write' : 'Edit'
      // 0.2 DiffBlock requires localized chrome; the toolview receives the
      // conversation locale seat as `props.t`.
      var t = typeof props.t === 'function' ? props.t : function (key) { return key }
      var labels = {
        codeLabel: t('codeBlock.title'),
        wrapLabel: t('codeBlock.wrap'),
        unwrapLabel: t('codeBlock.unwrap'),
        copy: t('copy'),
        copied: t('copied'),
        collapseAria: t('diff.collapseAria'),
        expandAria: function (count) { return t('diff.expandAria', { count: count }) },
        collapse: t('collapse'),
        expand: function (count) { return t('diff.expandRest', { count: count }) },
      }

      var wrap = {
        border: '1px solid rgba(128,128,140,.25)',
        borderRadius: '8px',
        margin: '2px 0',
        overflow: 'hidden',
      }
      var header = {
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px',
        background: 'rgba(128,128,140,.08)',
        fontSize: '12px', color: '#bbb',
      }
      var dot = {
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: '0',
        background: running ? '#4a7dff' : (diffs !== null ? '#3fb950' : '#d29922'),
      }
      var pathBtn = {
        background: 'none', border: 'none', cursor: 'pointer', padding: '0',
        font: 'inherit', color: '#8ab4f8',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        minWidth: '0',
      }

      var headerChildren = [h('span', { style: dot, key: 'dot' })]
      headerChildren.push(path !== null
        ? h('button', {
            type: 'button', style: pathBtn, title: path, key: 'path',
            onClick: function () { if (typeof openFile === 'function') openFile(path) },
          }, label + ' · ' + path)
        : h('span', { key: 'label' }, label))
      if (running) headerChildren.push(h('span', { style: { color: '#777', flexShrink: '0' }, key: 'st' }, '…'))
      if (line !== null && diffs === null) {
        headerChildren.push(h('span', {
          style: { color: '#f2a1a1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0' },
          title: line, key: 'err',
        }, line))
      }

      return h('div', { style: wrap },
        h('div', { style: header }, headerChildren),
        diffs !== null && h(DiffBlock, { diffs: diffs, labels: labels, maxLines: Infinity, key: 'diff' })
      )
    }

    exports.inject = ['slots']
    exports.apply = function (ctx) {
      ctx.slots.inject('tool.call.toolview', function* () {
        yield ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'edit',
          locale: 'conversation',
          priority: -1,
        }, InlineDiffRow)
        yield ctx.slots.register({
          name: 'tool.call.toolview',
          key: 'write',
          locale: 'conversation',
          priority: -1,
        }, InlineDiffRow)
      })
    }
    return module.exports
  },
})
