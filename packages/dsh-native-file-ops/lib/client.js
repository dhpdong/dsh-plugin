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
    var React = require('react')
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
.nfo-doc-edit{display:none;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer}
.nfo-doc-edit:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#eee)}
.nfo-edit-overlay{position:fixed;inset:0;z-index:2147483150;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.5)}
.nfo-edit{display:flex;flex-direction:column;width:min(900px,92vw);height:min(72vh,720px);border:1px solid var(--dsw-alias-border-l1,#333);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#18181d);box-shadow:0 24px 70px rgba(0,0,0,.55);color:var(--dsw-alias-label-primary,#eee);font:13px/1.5 system-ui,sans-serif;overflow:hidden}
.nfo-edit-head{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l1,#333);flex:0 0 auto}
.nfo-edit-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--dsw-alias-label-secondary,#aaa)}
.nfo-edit-dirty{width:8px;height:8px;border-radius:50%;background:var(--dsw-alias-button-info-fill,#4a7dff);visibility:hidden;flex:none}
.nfo-edit-dirty[data-dirty]{visibility:visible}
.nfo-edit-x{width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:inherit;font-size:18px;line-height:1;cursor:pointer}
.nfo-edit-x:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.nfo-edit-text{box-sizing:border-box;flex:1 1 auto;min-height:0;width:100%;padding:12px 14px;border:0;outline:none;resize:none;background:transparent;color:inherit;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}
.nfo-edit-foot{display:flex;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1,#333);flex:0 0 auto}
.nfo-edit-hint{flex:1 1 auto;color:var(--dsw-alias-label-tertiary,#888);font-size:12px}
.nfo-edit-foot button{height:30px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:inherit;font:inherit;cursor:pointer}
.nfo-edit-foot button.nfo-primary{border-color:transparent;background:var(--dsw-alias-button-info-fill,#4a7dff);color:#fff}
.nfo-edit-foot button:disabled{opacity:.5;cursor:default}
.nfo-inplace{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base,#111);min-height:0}
.nfo-inplace-bar{display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--dsw-alias-border-l1,#333);flex:0 0 auto}
.nfo-inplace-hint{flex:1 1 auto;min-width:0;color:var(--dsw-alias-label-tertiary,#888);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nfo-inplace-bar button{height:26px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2,#444);border-radius:6px;background:transparent;color:inherit;font:12px/1 system-ui,sans-serif;cursor:pointer}
.nfo-inplace-bar button.nfo-primary{border-color:transparent;background:var(--dsw-alias-button-info-fill,#4a7dff);color:#fff}
.nfo-inplace-bar button:disabled{opacity:.5;cursor:default}
.nfo-inplace-mount{display:flex;flex-direction:column;height:100%;min-height:0}
.nfo-inplace-text{box-sizing:border-box;flex:1 1 auto;min-height:0;width:100%;padding:10px 14px;border:0;outline:none;resize:none;background:transparent;color:var(--dsw-alias-label-primary,#eee);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}
.nfo-x-host{display:flex;flex-direction:column;height:100%;min-height:0}
.nfo-x{display:flex;flex-direction:column;height:100%;min-height:0;font:13px/1.5 system-ui,sans-serif;color:var(--dsw-alias-label-primary,#eee)}
.nfo-x-head{display:flex;align-items:center;gap:2px;padding:5px 6px;border-bottom:1px solid var(--dsw-alias-border-l3,#2a2a30);flex:0 0 auto;min-width:0}
.nfo-x-path{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;margin:0 4px;color:var(--dsw-alias-label-secondary,#aaa);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.nfo-x-btn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer;flex:none}
.nfo-x-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));color:var(--dsw-alias-label-primary,#eee)}
.nfo-x-btn:disabled{opacity:.35;cursor:default;background:transparent}
.nfo-x-svg{display:inline-flex;align-items:center;justify-content:center}
.nfo-x-body{flex:1 1 auto;min-height:0;overflow:auto;padding:4px 0 12px}
.nfo-x-row{display:flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;cursor:pointer;user-select:none;white-space:nowrap;color:var(--dsw-alias-label-primary,#eee)}
.nfo-x-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.nfo-x-chev{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;flex:none;color:var(--dsw-alias-label-tertiary,#888);transition:transform .12s}
.nfo-x-chev[data-open]{transform:rotate(90deg)}
.nfo-x-ico{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;flex:none;color:var(--dsw-alias-label-secondary,#aaa)}
.nfo-x-ico[data-cat="code"]{color:#5e9eff}
.nfo-x-ico[data-cat="doc"]{color:#b07cf0}
.nfo-x-ico[data-cat="image"]{color:#3fbf7f}
.nfo-x-ico[data-cat="media"]{color:#e07bb0}
.nfo-x-ico[data-cat="archive"]{color:#d9a441}
.nfo-x-ico[data-cat="exec"]{color:#e5645f}
.nfo-x-ico[data-cat="config"]{color:#8a94a6}
.nfo-x-ico[data-cat="model"]{color:#35b8b8}
.nfo-x-ico[data-cat="data"]{color:#8fae4a}
.nfo-x-name{overflow:hidden;text-overflow:ellipsis;min-width:0}
.nfo-x-hidden .nfo-x-name{opacity:.55}
.nfo-x-note{padding:5px 14px;color:var(--dsw-alias-label-tertiary,#888);font-size:12px}
.nfo-x-retry{cursor:pointer;color:var(--dsw-alias-label-secondary,#aaa);text-decoration:underline;text-underline-offset:2px}
.nfo-picker{display:flex;flex-direction:column;width:min(520px,92vw);height:min(66vh,580px);gap:8px}
.nfo-picker-path{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left;padding:6px 8px;border-radius:6px;background:var(--dsw-alias-bg-layer-2,#1e1e24);color:var(--dsw-alias-label-secondary,#aaa);font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.nfo-picker-list{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:1px;padding:2px}
.nfo-picker-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;cursor:pointer;white-space:nowrap;overflow:hidden}
.nfo-picker-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.nfo-picker-row span:last-child{overflow:hidden;text-overflow:ellipsis}
.nfo-picker-follow{margin-right:auto;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);font:12px/1 system-ui,sans-serif;cursor:pointer;padding:0 4px}
.nfo-picker-follow:hover{color:var(--dsw-alias-label-primary,#eee);text-decoration:underline}
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
      if (explorer !== null) {
        window.setTimeout(function () { if (explorer !== null) explorer.reload() }, 80)
        return
      }
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
        var root = (browserRoot() || cwd || '').replace(/[\\/]+$/, '')
        var relPath = absPath
        if (root === '/') relPath = absPath.replace(/^\/+/, '')
        else if (root !== '' && absPath.indexOf(root + '/') === 0) relPath = absPath.slice(root.length + 1)
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
      var targetDir = typeof dir === 'string' && dir !== '' ? dir : browserRoot()
      dialog(
        kind === 'folder' ? L('新建文件夹', 'New folder') : L('新建文件', 'New file'),
        '',
        kind === 'folder' ? L('文件夹名称', 'Folder name') : L('文件名', 'File name'),
        function (name) {
          return sidebarCall(currentCtx, 'fs.create', { dir: targetDir, name: name, kind: kind === 'folder' ? 'directory' : 'file' }).then(function () {
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



    // ── In-place text editing for the native document preview ─────────────
    // The native right-Sidebar preview is read-only. A small "edit" action in
    // the document header opens a raw-text editor (one textarea over the
    // fence-safe /sidebar/api/fs.read|fs.write carrier), saves in place, and
    // asks the preview to reload. Binary or truncated files are refused so a
    // truncated read can never overwrite the rest of the file.

    var editorOverlay = null
    var autoFrame = null

    function PencilGlyph() {
      return React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        React.createElement('path', { d: 'M10.8 2.2l3 3L6 13H3v-3z', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinejoin: 'round' }))
    }

    function reloadTextPreview() {
      var buttons = document.querySelectorAll('[data-textpreview-tool="reload"]')
      for (var i = 0; i < buttons.length; i += 1) {
        var rect = buttons[i].getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          buttons[i].click()
          return
        }
      }
    }

    function openTextEditor(ctx, path, button) {
      // Resolve the preview body up front so a second pencil click focuses
      // the running editor instead of re-reading and discarding edits.
      var host = button && button.closest ? button.closest('[data-sidebar-right-tab]') : null
      var preview = null
      if (host !== null) {
        var nodes = host.querySelectorAll('[data-textpreview-body]')
        for (var i = 0; i < nodes.length; i += 1) {
          if (nodes[i].getClientRects().length > 0) { preview = nodes[i]; break }
        }
      }
      if (preview !== null) {
        var running = preview.querySelector('.nfo-inplace')
        if (running !== null) {
          var area = running.querySelector('.cm-content')
          if (area !== null && typeof area.focus === 'function') area.focus()
          return
        }
      }
      var auto = preview !== null && preview.getAttribute('data-nfo-auto-pending') === '1'
      function markSkip() {
        if (preview === null) return
        var owner = preview.closest('[data-sidebar-right-tab]')
        var pathNode = owner === null ? null : owner.querySelector('[data-textpreview-path]')
        preview.setAttribute('data-nfo-auto-skip', pathNode === null ? '' : (pathNode.textContent || ''))
      }
      sidebarCall(ctx, 'fs.read', { path: path }).then(function (value) {
        if (value.kind !== 'text') {
          markSkip()
          if (!auto) toast(L('该文件不是文本，无法编辑', 'Not a text file'))
          return
        }
        if (value.truncated === true) {
          markSkip()
          if (!auto) toast(L('文件过大，暂不支持在浏览器中编辑', 'File too large to edit here'))
          return
        }
        // Edit in place inside the document body when the action lives in a
        // real preview tab; the modal stays as the fallback for any other
        // invocation (e.g. a detached action surface).
        if (preview !== null) showInlineEditor(ctx, path, value.content, preview)
        else showTextEditor(ctx, path, value.content)
      }).catch(function (error) {
        markSkip()
        if (!auto) toast(String(error && error.message ? error.message : error))
      })
    }

    function showTextEditor(ctx, path, initial) {
      if (editorOverlay !== null) {
        editorOverlay.remove()
        editorOverlay = null
      }
      var overlay = document.createElement('div')
      overlay.className = 'nfo-edit-overlay'

      var dialog = document.createElement('div')
      dialog.className = 'nfo-edit'

      var head = document.createElement('div')
      head.className = 'nfo-edit-head'
      var pathNode = document.createElement('span')
      pathNode.className = 'nfo-edit-path'
      pathNode.textContent = path
      pathNode.title = path
      var dirtyDot = document.createElement('span')
      dirtyDot.className = 'nfo-edit-dirty'
      var closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.className = 'nfo-edit-x'
      closeButton.textContent = '×'
      closeButton.setAttribute('aria-label', L('关闭', 'Close'))
      head.appendChild(pathNode)
      head.appendChild(dirtyDot)
      head.appendChild(closeButton)

      var textarea = document.createElement('textarea')
      textarea.className = 'nfo-edit-text'
      textarea.spellcheck = false
      textarea.wrap = 'off'
      textarea.value = initial
      textarea.setAttribute('aria-label', L('文件内容', 'File content'))

      var foot = document.createElement('div')
      foot.className = 'nfo-edit-foot'
      var hint = document.createElement('span')
      hint.className = 'nfo-edit-hint'
      hint.textContent = L('Ctrl+S 保存 · Esc 取消', 'Ctrl+S save · Esc cancel')
      var cancelButton = document.createElement('button')
      cancelButton.type = 'button'
      cancelButton.textContent = L('取消', 'Cancel')
      var saveButton = document.createElement('button')
      saveButton.type = 'button'
      saveButton.className = 'nfo-primary'
      saveButton.textContent = L('保存', 'Save')
      foot.appendChild(hint)
      foot.appendChild(cancelButton)
      foot.appendChild(saveButton)

      dialog.appendChild(head)
      dialog.appendChild(textarea)
      dialog.appendChild(foot)
      overlay.appendChild(dialog)
      document.body.appendChild(overlay)
      editorOverlay = overlay

      var dirty = false
      var saving = false
      var closed = false

      function setDirty(value) {
        dirty = value
        if (value) dirtyDot.setAttribute('data-dirty', '')
        else dirtyDot.removeAttribute('data-dirty')
      }

      function cleanup() {
        if (closed) return
        closed = true
        document.removeEventListener('keydown', onKey, true)
        overlay.remove()
        if (editorOverlay === overlay) editorOverlay = null
      }

      function close() {
        if (saving) return
        if (dirty && !window.confirm(L('放弃未保存的修改？', 'Discard unsaved changes?'))) return
        cleanup()
      }

      function save() {
        if (saving || closed) return
        saving = true
        saveButton.disabled = true
        saveButton.textContent = L('保存中…', 'Saving…')
        sidebarCall(ctx, 'fs.write', { path: path, content: textarea.value }).then(function () {
          saving = false
          setDirty(false)
          cleanup()
          toast(L('已保存', 'Saved'))
          reloadTextPreview()
        }).catch(function (error) {
          saving = false
          saveButton.disabled = false
          saveButton.textContent = L('保存', 'Save')
          toast(String(error && error.message ? error.message : error))
        })
      }

      function onKey(event) {
        if (event.key === 'Escape') {
          event.preventDefault()
          close()
          return
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          save()
        }
      }

      textarea.addEventListener('input', function () { setDirty(true) })
      closeButton.addEventListener('click', close)
      cancelButton.addEventListener('click', close)
      saveButton.addEventListener('click', save)
      overlay.addEventListener('mousedown', function (event) {
        if (event.target === overlay) close()
      })
      document.addEventListener('keydown', onKey, true)
      textarea.focus()
      textarea.setSelectionRange(0, 0)
    }

    /**
     * The in-place editor: a textarea layered over the document body, with a
     * compact save/cancel bar. Keeps the tab, path header and preview chrome
     * exactly where they are — only the scrollable body is covered.
     */
    /** Cached lazy load of sidebar-lite's CodeMirror editor chunk. */
    var editorChunkPromise = null
    function loadEditorChunk() {
      if (editorChunkPromise !== null) return editorChunkPromise
      editorChunkPromise = new Promise(function (resolve, reject) {
        var factory = globalThis.__dshChunks__ && globalThis.__dshChunks__.editor
        function materialize() {
          var fn = globalThis.__dshChunks__ && globalThis.__dshChunks__.editor
          if (typeof fn !== 'function') { reject(new Error('editor chunk missing')); return }
          try {
            resolve(fn(function (spec) {
              if (spec === 'react') return React
              return require(spec)
            }))
          } catch (error) { reject(error) }
        }
        if (typeof factory === 'function') { materialize(); return }
        var script = document.createElement('script')
        script.src = '/sidebar/bundle/editor.js'
        script.onload = materialize
        script.onerror = function () { reject(new Error('editor chunk failed to load')) }
        document.head.appendChild(script)
      }).catch(function (error) {
        editorChunkPromise = null
        throw error
      })
      return editorChunkPromise
    }

    function editorViewerId(path) {
      var lower = String(path).toLowerCase()
      if (/\.(md|markdown|mdx)$/.test(lower)) return 'markdown'
      if (/\.(html|htm)$/.test(lower)) return 'html'
      return 'code'
    }

    /**
     * The always-on editor pane: mounts sidebar-lite's CodeMirror TextEditor
     * (syntax highlighting, markdown/html preview toggle, Ctrl+S) over the
     * document body. autoSave writes every idle pause and initialMode 'edit'
     * keeps the source editable from the first paint.
     */
    function showInlineEditor(ctx, path, initial, preview) {
      var state = ctxState(ctx)
      if (state === undefined) {
        showTextEditor(ctx, path, initial)
        return
      }
      var existing = preview.querySelector('.nfo-inplace')
      if (existing !== null) {
        var previous = existing.__nfoCleanup
        if (typeof previous === 'function') previous()
        else existing.remove()
      }
      var wasPosition = preview.style.position
      var wasOverflow = preview.style.overflow
      if (window.getComputedStyle(preview).position === 'static') preview.style.position = 'relative'
      preview.style.overflow = 'hidden'

      var box = document.createElement('div')
      box.className = 'nfo-inplace'
      var mount = document.createElement('div')
      mount.className = 'nfo-inplace-mount'
      box.appendChild(mount)
      preview.appendChild(box)

      var root = null
      var closed = false
      var removal = new MutationObserver(function () {
        if (!box.isConnected) cleanup()
      })

      function cleanup() {
        if (closed) return
        closed = true
        removal.disconnect()
        if (root !== null) {
          try { root.unmount() } catch (error) { /* already gone */ }
          root = null
        }
        box.remove()
        preview.style.position = wasPosition
        preview.style.overflow = wasOverflow
      }
      box.__nfoCleanup = cleanup
      removal.observe(preview, { childList: true })

      loadEditorChunk().then(function (chunk) {
        if (closed) return
        var ReactDOMClient = require('react-dom/client')
        root = ReactDOMClient.createRoot(mount)
        root.render(React.createElement(chunk.TextEditor, {
          ctx: ctx,
          scope: { sessionId: state.sessionId, cwd: state.cwd },
          path: path,
          title: path,
          viewerId: editorViewerId(path),
          content: initial,
          truncated: false,
          autoSave: true,
          initialMode: 'edit',
          lineWrapping: false,
        }))
      }).catch(function () {
        cleanup()
        showTextEditor(ctx, path, initial)
      })
    }

    /** The document header action: edit the previewed file in place. */
    function DocEditAction(props) {
      var path = props && typeof props.absolutePath === 'string' ? props.absolutePath : ''
      if (path === '') return null
      return React.createElement('button', {
        type: 'button',
        className: 'nfo-doc-edit',
        title: L('编辑', 'Edit'),
        'aria-label': L('编辑', 'Edit'),
        onClick: function (event) { if (currentCtx) openTextEditor(currentCtx, path, event.currentTarget) },
      }, PencilGlyph())
    }

    /**
     * The merged browser/editor experience: every visible text preview opens
     * its in-place editor as soon as it appears, no click or double-click.
     * A hidden header action carries the absolute path and reuses the same
     * open path; previews that cannot be edited (binary, truncated) carry a
     * path-keyed skip marker so the observer never loops on them.
     */
    function autoOpenPreviewEditors() {
      var tabs = document.querySelectorAll('[data-sidebar-right-tab]')
      for (var i = 0; i < tabs.length; i += 1) {
        var tab = tabs[i]
        if (tab.getClientRects().length === 0) continue
        if (tab.querySelector('[data-textpreview-unsupported]') !== null) continue
        var body = null
        var bodies = tab.querySelectorAll('[data-textpreview-body]')
        for (var j = 0; j < bodies.length; j += 1) {
          if (bodies[j].getClientRects().length > 0) { body = bodies[j]; break }
        }
        if (body === null) continue
        if (body.querySelector('.nfo-inplace') !== null) continue
        if (body.getAttribute('data-nfo-auto-pending') === '1') continue
        var pathNode = tab.querySelector('[data-textpreview-path]')
        var pathKey = pathNode === null ? '' : (pathNode.textContent || '')
        if (body.getAttribute('data-nfo-auto-skip') === pathKey) continue
        var button = tab.querySelector('button.nfo-doc-edit')
        if (button === null) continue
        body.setAttribute('data-nfo-auto-pending', '1')
        button.click()
        window.setTimeout((function (target) {
          return function () {
            if (target.isConnected && target.querySelector('.nfo-inplace') === null) {
              target.removeAttribute('data-nfo-auto-pending')
            }
          }
        })(body), 4000)
      }
    }

    function scheduleAutoOpenEditors() {
      if (autoFrame !== null) return
      // A short timer instead of rAF: the observer sees every streaming chat
      // mutation, and a 60ms coalescing window keeps the scan off the frame
      // budget while still feeling immediate.
      autoFrame = window.setTimeout(function () {
        autoFrame = null
        autoOpenPreviewEditors()
      }, 60)
    }

    // ── Global file browser: one root, shared by every workspace ─────────
    // The native file tab lists the CURRENT session workspace, so switching
    // workspace switches the explorer. This plugin takes that tab type over
    // and lists one remembered directory instead: every session shows the
    // same folder, and "open folder" can point it anywhere on the host (the
    // host's fs routes run with the workspace fence lifted by
    // `config.allowOutsideWorkspace`).
    var ROOT_KEY = 'dsh.files.root'
    var explorer = null

    function readRoot() {
      try {
        var value = window.localStorage.getItem(ROOT_KEY)
        return typeof value === 'string' && value.charAt(0) === '/' ? value : undefined
      } catch (error) { return undefined }
    }

    function writeRoot(path) {
      try {
        if (typeof path === 'string' && path !== '') window.localStorage.setItem(ROOT_KEY, path)
        else window.localStorage.removeItem(ROOT_KEY)
      } catch (error) { /* storage disabled: the session cwd is the fallback */ }
    }

    /** The expansion set, remembered across sessions, panes and workspaces. */
    var EXPANDED_KEY = 'dsh.files.expanded'
    var SCROLL_KEY = 'dsh.files.scroll'

    function readExpanded() {
      try {
        var raw = window.localStorage.getItem(EXPANDED_KEY)
        if (typeof raw !== 'string' || raw === '') return {}
        var list = JSON.parse(raw)
        var map = {}
        if (!Array.isArray(list)) return map
        for (var i = 0; i < list.length; i += 1) if (typeof list[i] === 'string') map[list[i]] = true
        return map
      } catch (error) { return {} }
    }

    function writeExpanded(map) {
      try {
        var list = []
        for (var path in map) {
          if (!Object.prototype.hasOwnProperty.call(map, path) || map[path] !== true) continue
          list.push(path)
          if (list.length >= 300) break
        }
        window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(list))
      } catch (error) { /* storage disabled: state stays per mount */ }
    }

    function readScroll() {
      try {
        var raw = window.localStorage.getItem(SCROLL_KEY)
        var map = typeof raw === 'string' && raw !== '' ? JSON.parse(raw) : {}
        return map && typeof map === 'object' ? map : {}
      } catch (error) { return {} }
    }

    function writeScroll(map) {
      try { window.localStorage.setItem(SCROLL_KEY, JSON.stringify(map)) } catch (error) { /* ignore */ }
    }

    /**
     * Directory listings shared by every explorer instance in this page.
     * Switching workspace remounts the tab; without this the tree re-fetched
     * every expanded level, so it looked like a different browser. A short TTL
     * keeps externally-made changes visible while still making the switch
     * instant.
     */
    var TREE_CACHE = {}
    var TREE_TTL_MS = 30000

    function cachedListing(path) {
      var hit = TREE_CACHE[path]
      if (hit === undefined) return undefined
      if (Date.now() - hit.at > TREE_TTL_MS) { delete TREE_CACHE[path]; return undefined }
      return hit.entries
    }

    function rememberListing(path, entries) {
      TREE_CACHE[path] = { entries: entries, at: Date.now() }
    }

    function forgetListing(path) {
      delete TREE_CACHE[path]
      for (var key in TREE_CACHE) {
        if (!Object.prototype.hasOwnProperty.call(TREE_CACHE, key)) continue
        if (key === path || key.indexOf(path.replace(/[\\/]+$/, '') + '/') === 0) delete TREE_CACHE[key]
      }
    }

    /** The active browser root: the remembered folder, else the session cwd. */
    function browserRoot() {
      var stored = readRoot()
      if (stored !== undefined) return stored
      var state = ctxState(currentCtx)
      return state !== undefined && typeof state.cwd === 'string' ? state.cwd : ''
    }

    function parentOfPath(path) {
      var clean = String(path).replace(/[\\/]+$/, '')
      var cut = clean.lastIndexOf('/')
      if (cut < 0) return ''
      if (cut === 0) return '/'
      return clean.slice(0, cut)
    }

    var ICON_FOLDER = 'M2 4.4a1 1 0 0 1 1-1h3.3l1.3 1.5h5.4a1 1 0 0 1 1 1v6.7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z'
    var ICON_FILE = 'M4.2 2h4.9l2.7 2.7V14H4.2zM9 2v3h3'
    var ICON_CHEVRON = 'M6.2 3.6 10.6 8l-4.4 4.4'
    var ICON_UP = 'M8 12.6V3.8M4.2 7.2 8 3.4l3.8 3.8'
    var ICON_RELOAD = 'M13.2 8a5.2 5.2 0 1 1-1.6-3.8M13.2 2.6v2.8h-2.8'
    var ICON_FOLDER_OPEN = 'M2 12.4V4.4a1 1 0 0 1 1-1h3.3l1.3 1.5h5.4a1 1 0 0 1 1 1v1.2M2 12.4 3.9 7h11.3l-2 5.4z'

    // ── File-type categories ────────────────────────────────────────────
    // One glyph per FAMILY instead of per extension: the tree stays readable
    // without a 40-icon set, and each family keeps a muted accent colour.
    var ICON_CAT = {
      code: 'M5.4 4.4 2.2 8l3.2 3.6M10.6 4.4 13.8 8l-3.2 3.6',
      doc: 'M4 1.8h5l3 3V14H4zM9 1.8v3h3M6 7.2h4M6 9.6h4',
      image: 'M2.6 3.4h10.8v9.2H2.6zM3 11.6l3.2-3 2.3 1.9 2.2-1.7 2.9 2.6',
      media: 'M8 2.5a5.5 5.5 0 1 0 .01 0M6.6 5.6 10.4 8l-3.8 2.4z',
      archive: 'M2.6 5.6h10.8v7.8H2.6zM2.6 5.6 4 2.6h8l1.4 3M8 5.6v2M8 9.2v1.6',
      exec: 'M2.6 3.4h10.8v9.2H2.6zM5.2 6.6 7.2 8.2 5.2 9.8M8.6 9.9h3',
      config: 'M3 5.2h3.2M8.4 5.2h4.6M3 10.8h5.4M10.6 10.8h2.4M6.2 3.6v3.2M9.4 9.2v3.2',
      model: 'M8 1.9 13.6 4.7v6.6L8 14.1 2.4 11.3V4.7zM8 8.1v6M8 8.1 2.4 4.7M8 8.1l5.6-3.4',
      data: 'M3.4 4.4c0-.9 2-1.6 4.6-1.6s4.6.7 4.6 1.6-2 1.6-4.6 1.6-4.6-.7-4.6-1.6zM3.4 4.4v7.2c0 .9 2 1.6 4.6 1.6s4.6-.7 4.6-1.6V4.4',
    }

    var CATEGORY_EXTENSIONS = {
      code: 'js mjs cjs jsx ts tsx vue svelte astro py pyi go rs c h cc cpp cxx hpp hxx java kt kts scala rb php swift m mm lua pl pm sh bash zsh fish ps1 bat cmd sql html htm css scss sass less styl ipynb ml hs clj ex exs erl dart jl r zig nim v sol asm',
      doc: 'md markdown mdx rst txt log pdf doc docx odt rtf xls xlsx ods csv tsv ppt pptx odp epub tex',
      image: 'png jpg jpeg gif webp svg bmp ico tif tiff avif heic heif psd xcf',
      media: 'mp4 mkv avi mov webm m4v flv wmv mp3 wav flac ogg m4a aac opus wma mid midi',
      archive: 'zip tar gz tgz bz2 xz 7z rar deb rpm whl apk jar iso zst lz4 cab',
      exec: 'exe msi bin run appimage dll so dylib sys out elf',
      config: 'json jsonc json5 yaml yml toml ini cfg conf env properties lock plist rc',
      model: 'pt pth ckpt onnx safetensors gguf ggml h5 tflite engine pb',
      data: 'db sqlite sqlite3 parquet arrow npy npz pkl pickle feather orc avro',
    }

    /** Extension → category map, built once (first match wins). */
    var EXT_TO_CATEGORY = (function () {
      var map = {}
      for (var category in CATEGORY_EXTENSIONS) {
        if (!Object.prototype.hasOwnProperty.call(CATEGORY_EXTENSIONS, category)) continue
        var list = CATEGORY_EXTENSIONS[category].split(' ')
        for (var i = 0; i < list.length; i += 1) map[list[i]] = category
      }
      return map
    })()

    /** Well-known extension-less names that still deserve a family glyph. */
    var NAME_CATEGORY = {
      dockerfile: 'code', makefile: 'code', 'cmakelists.txt': 'code', '.gitignore': 'config',
      '.gitattributes': 'config', '.env': 'config', '.npmrc': 'config', '.dockerignore': 'config',
      '.editorconfig': 'config', license: 'doc', 'readme': 'doc', notice: 'doc', authors: 'doc',
      gemsfile: 'code', rakefile: 'code',
    }

    /** The family glyph key of one file name ('' → the generic file icon). */
    function fileCategory(name) {
      var lower = String(name).toLowerCase()
      var byName = NAME_CATEGORY[lower]
      if (byName !== undefined) return byName
      var dot = lower.lastIndexOf('.')
      if (dot <= 0 || dot === lower.length - 1) return ''
      var ext = lower.slice(dot + 1)
      return EXT_TO_CATEGORY[ext] || ''
    }

    function svgIcon(pathData) {
      var span = document.createElement('span')
      span.className = 'nfo-x-svg'
      span.innerHTML = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" '
        + 'stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
        + '<path d="' + pathData + '"/></svg>'
      return span
    }

    function toolButton(label, markup, onClick) {
      var button = document.createElement('button')
      button.type = 'button'
      button.className = 'nfo-x-btn'
      button.title = label
      button.setAttribute('aria-label', label)
      button.appendChild(svgIcon(markup))
      button.addEventListener('click', function (event) {
        event.stopPropagation()
        onClick()
      })
      return button
    }

    /** Open one file in the right Sidebar through the resource protocol. */
    function openPathInSidebar(ctx, path) {
      var state = ctxState(ctx)
      if (state === undefined) { toast(L('没有活动会话', 'no active session')); return }
      var normalized = String(path).replace(/\\/g, '/')
      var address = 'dsh-resource://file/session/' + encodeURIComponent(state.sessionId) + '/'
        + normalized.split('/').map(encodeURIComponent).join('/')
      var sidebarRight = typeof ctx.get === 'function' ? ctx.get('sidebarRight') : ctx.sidebarRight
      if (sidebarRight && typeof sidebarRight.openResource === 'function') {
        try { sidebarRight.openResource(address); return } catch (error) { /* fall through */ }
      }
      toast(L('无法打开文件', 'Cannot open the file'))
    }

    /** The in-app folder chooser used by "open folder" (any host directory). */
    function openRootPicker(ctx, onPick) {
      var start = browserRoot()
      var here = start !== '' ? start : '/'
      var overlay = document.createElement('div')
      overlay.className = 'nfo-overlay'
      var box = document.createElement('div')
      box.className = 'nfo-dialog nfo-picker'
      var heading = document.createElement('h3')
      heading.textContent = L('打开文件夹', 'Open folder')
      var pathLine = document.createElement('div')
      pathLine.className = 'nfo-picker-path'
      var list = document.createElement('div')
      list.className = 'nfo-picker-list'
      var actions = document.createElement('div')
      actions.className = 'nfo-actions'
      var follow = document.createElement('button')
      follow.type = 'button'
      follow.className = 'nfo-picker-follow'
      follow.textContent = L('跟随工作区', 'Follow the workspace')
      var cancel = document.createElement('button')
      cancel.type = 'button'
      cancel.textContent = L('取消', 'Cancel')
      var confirm = document.createElement('button')
      confirm.type = 'button'
      confirm.className = 'nfo-primary'
      confirm.textContent = L('打开此文件夹', 'Open this folder')

      var close = function () { overlay.remove() }
      var go = function (path) {
        here = path
        pathLine.textContent = path
        pathLine.title = path
        list.textContent = ''
        var loading = document.createElement('div')
        loading.className = 'nfo-x-note'
        loading.textContent = L('正在加载…', 'Loading…')
        list.appendChild(loading)
        sidebarCall(ctx, 'fs.tree', { path: path }).then(function (listing) {
          list.textContent = ''
          var entries = (listing.entries || []).filter(function (entry) { return entry.isDir })
          var parent = parentOfPath(path)
          if (parent !== '' && parent !== path) {
            var upRow = document.createElement('div')
            upRow.className = 'nfo-picker-row'
            upRow.appendChild(svgIcon(ICON_UP))
            var upName = document.createElement('span')
            upName.textContent = '..'
            upRow.appendChild(upName)
            upRow.addEventListener('click', function () { go(parent) })
            list.appendChild(upRow)
          }
          if (entries.length === 0 && list.childNodes.length === 0) {
            var empty = document.createElement('div')
            empty.className = 'nfo-x-note'
            empty.textContent = L('没有子文件夹', 'No subfolders')
            list.appendChild(empty)
          }
          for (var i = 0; i < entries.length; i += 1) {
            (function (entry) {
              var row = document.createElement('div')
              row.className = 'nfo-picker-row'
              row.appendChild(svgIcon(ICON_FOLDER))
              var name = document.createElement('span')
              name.textContent = entry.name
              row.appendChild(name)
              row.addEventListener('click', function () { go(entry.path) })
              list.appendChild(row)
            })(entries[i])
          }
        }, function (error) {
          list.textContent = ''
          var failed = document.createElement('div')
          failed.className = 'nfo-x-note'
          failed.textContent = String(error && error.message ? error.message : error)
          list.appendChild(failed)
        })
      }

      cancel.addEventListener('click', close)
      confirm.addEventListener('click', function () { var next = here; close(); onPick(next) })
      follow.addEventListener('click', function () { close(); onPick('') })
      actions.appendChild(follow)
      actions.appendChild(cancel)
      actions.appendChild(confirm)
      box.appendChild(heading)
      box.appendChild(pathLine)
      box.appendChild(list)
      box.appendChild(actions)
      overlay.appendChild(box)
      overlay.addEventListener('mousedown', function (event) { if (event.target === overlay) close() })
      document.body.appendChild(overlay)
      go(here)
    }

    /**
     * One explorer instance over `browserRoot()`: a lazily loaded tree, the
     * path header, and the "open folder" entry point. Rows carry the same
     * `data-files-path` / `data-files-entry` attributes the native tree used,
     * so the shared context menu, drag-and-drop and download code keep
     * working unchanged.
     */
    function createExplorer(host, ctx) {
      var root = browserRoot()
      var cache = {}
      var loading = {}
      var expanded = readExpanded()
      var scrollByRoot = readScroll()
      var disposed = false

      var wrap = document.createElement('div')
      wrap.className = 'nfo-x'
      var head = document.createElement('div')
      head.className = 'nfo-x-head'
      var upButton = toolButton(L('上级文件夹', 'Parent folder'), ICON_UP, function () {
        var next = parentOfPath(root)
        if (next !== '' && next !== root) setRoot(next)
      })
      var reloadButton = toolButton(L('刷新', 'Refresh'), ICON_RELOAD, function () { reload() })
      var pathLabel = document.createElement('span')
      pathLabel.className = 'nfo-x-path'
      var openButton = toolButton(L('打开文件夹', 'Open folder'), ICON_FOLDER_OPEN, function () {
        openRootPicker(ctx, function (next) { if (next === '') resetRoot(); else setRoot(next) })
      })
      head.appendChild(upButton)
      head.appendChild(reloadButton)
      head.appendChild(pathLabel)
      head.appendChild(openButton)
      var body = document.createElement('div')
      body.className = 'nfo-x-body'
      body.setAttribute('data-files-body', '')
      body.setAttribute('data-files-state', 'tree')
      wrap.appendChild(head)
      wrap.appendChild(body)
      host.appendChild(wrap)

      var scrollTimer = null
      body.addEventListener('scroll', function () {
        scrollByRoot[root] = body.scrollTop
        if (scrollTimer !== null) return
        scrollTimer = window.setTimeout(function () {
          scrollTimer = null
          writeScroll(scrollByRoot)
        }, 250)
      })

      function note(text) {
        var node = document.createElement('div')
        node.className = 'nfo-x-note'
        node.textContent = text
        return node
      }

      // A request that never answers (the page outlived a host restart) must
      // not leave the tree spinning forever: every load has a deadline, and
      // transient failures (a session still hydrating right after a switch)
      // retry silently before the error surfaces with a manual retry.
      var MAX_ATTEMPTS = 3
      var LOAD_TIMEOUT_MS = 6000
      var attempts = {}

      function load(path) {
        if (disposed || loading[path] === true) return
        var shared = cachedListing(path)
        if (shared !== undefined) {
          cache[path] = { entries: shared }
          render()
          return
        }
        loading[path] = true
        var settled = false
        var timer = window.setTimeout(function () {
          settle({ error: L('连接宿主超时（宿主可能已重启），点此重试', 'The host did not answer (it may have restarted) — click to retry'), final: true })
        }, LOAD_TIMEOUT_MS)
        function settle(result) {
          if (settled || disposed) return
          settled = true
          window.clearTimeout(timer)
          delete loading[path]
          if (result.error !== undefined) {
            attempts[path] = (attempts[path] || 0) + 1
            // Only a fast failure (a session still hydrating after a switch)
            // is worth retrying; a silent timeout means the page lost the
            // host and the user must reload, so surface it at once.
            if (result.final !== true && attempts[path] < MAX_ATTEMPTS) {
              window.setTimeout(function () { if (!disposed) load(path) }, 1200 * attempts[path])
              return
            }
            delete attempts[path]
            cache[path] = { error: result.error }
          } else {
            delete attempts[path]
            cache[path] = { entries: result.entries || [] }
            rememberListing(path, cache[path].entries)
          }
          render()
        }
        sidebarCall(ctx, 'fs.tree', { path: path }).then(function (listing) {
          settle({ entries: listing.entries })
        }, function (error) {
          settle({ error: String(error && error.message ? error.message : error) })
        })
      }

      function level(dirPath, depth) {
        var frag = document.createDocumentFragment()
        var listing = cache[dirPath]
        if (listing === undefined || listing.entries === undefined) return frag
        for (var i = 0; i < listing.entries.length; i += 1) {
          var entry = listing.entries[i]
          frag.appendChild(row(entry, depth))
          if (entry.isDir && expanded[entry.path] === true) {
            if (cache[entry.path] === undefined) {
              load(entry.path)
              frag.appendChild(note(L('正在加载…', 'Loading…')))
            } else if (cache[entry.path].error !== undefined) {
              frag.appendChild(note(cache[entry.path].error))
            } else {
              frag.appendChild(level(entry.path, depth + 1))
            }
          }
        }
        return frag
      }

      function row(entry, depth) {
        var node = document.createElement('div')
        node.className = 'nfo-x-row'
        node.setAttribute('data-files-path', entry.path)
        node.setAttribute('data-files-entry', entry.isDir ? 'directory' : 'file')
        node.setAttribute('draggable', 'true')
        node.style.paddingLeft = (6 + depth * 14) + 'px'
        if (entry.hidden === true) node.className += ' nfo-x-hidden'
        var chev = document.createElement('span')
        chev.className = 'nfo-x-chev'
        if (entry.isDir) {
          chev.appendChild(svgIcon(ICON_CHEVRON))
          if (expanded[entry.path] === true) chev.setAttribute('data-open', '')
        }
        node.appendChild(chev)
        var category = entry.isDir ? 'folder' : fileCategory(entry.name)
        var ico = document.createElement('span')
        ico.className = 'nfo-x-ico'
        ico.setAttribute('data-cat', category)
        ico.appendChild(svgIcon(entry.isDir ? ICON_FOLDER : (ICON_CAT[category] || ICON_FILE)))
        node.appendChild(ico)
        var name = document.createElement('span')
        name.className = 'nfo-x-name'
        name.textContent = entry.name
        name.title = entry.name
        node.appendChild(name)
        node.addEventListener('click', function () {
          if (entry.isDir) {
            if (expanded[entry.path] === true) delete expanded[entry.path]
            else expanded[entry.path] = true
            writeExpanded(expanded)
            render()
            return
          }
          openPathInSidebar(ctx, entry.path)
        })
        return node
      }

      // Re-entrancy guard: a cached level resolves synchronously inside
      // level(), and painting from there would append a second tree on top of
      // the one still being built (duplicate rows). Nested renders only mark
      // the tree dirty; the outer pass repaints once it finishes.
      var rendering = false
      var dirty = false

      function render() {
        if (disposed) return
        if (rendering) { dirty = true; return }
        rendering = true
        try { paint() } finally { rendering = false }
        if (dirty) { dirty = false; render() }
      }

      function paint() {
        if (disposed) return
        pathLabel.textContent = root
        pathLabel.title = root
        var parent = parentOfPath(root)
        upButton.disabled = parent === '' || parent === root
        body.textContent = ''
        // The body is rebuilt from scratch, so the remembered offset is
        // re-applied on the next frame (after the rows are laid out).
        var restore = scrollByRoot[root] || 0
        window.requestAnimationFrame(function () {
          if (!disposed && body.isConnected && restore > 0) body.scrollTop = restore
        })
        var listing = cache[root]
        if (listing === undefined) {
          body.appendChild(note(L('正在加载…', 'Loading…')))
          load(root)
          return
        }
        if (listing.error !== undefined) {
          var failed = note(listing.error)
          failed.className += ' nfo-x-retry'
          failed.title = L('点击重试', 'Click to retry')
          failed.addEventListener('click', function () {
            delete cache[root]
            attempts[root] = 0
            render()
          })
          body.appendChild(failed)
          return
        }
        if (listing.entries.length === 0) {
          body.appendChild(note(L('此文件夹为空', 'This folder is empty')))
          return
        }
        body.appendChild(level(root, 0))
      }

      function setRoot(next) {
        root = next
        writeRoot(next)
        cache = {}
        loading = {}
        attempts = {}
        render()
      }

      function resetRoot() {
        writeRoot('')
        writeTermCwd('')

        var state = ctxState(ctx)
        setRoot(state !== undefined && typeof state.cwd === 'string' ? state.cwd : '/')
      }

      function reload() {
        forgetListing(root)
        cache = {}
        loading = {}
        render()
      }

      render()

      return {
        reload: reload,
        dispose: function () {
          disposed = true
          wrap.remove()
        },
      }
    }

    var FILES_TAKEOVER_ID = 'dsh-native-file-ops/files-global'

    function GlobalFilesBody(props) {
      var hostRef = React.useRef(null)
      React.useEffect(function () {
        var node = hostRef.current
        if (node === null) return undefined
        var instance = createExplorer(node, currentCtx)
        explorer = instance
        return function () {
          if (explorer === instance) explorer = null
          instance.dispose()
        }
      }, [])
      return React.createElement('div', { className: 'nfo-x-host', ref: hostRef })
    }

    /**
     * Take the native `files` tab type over. The right Sidebar keeps one
     * surface per session, so "shared by every workspace" means one SHARED
     * ROOT: whichever session renders the tab, it lists the same directory.
     * A registration failure keeps the untouched native tree (the DOM
     * enhancements above still apply), so this never breaks the sidebar.
     */
    function registerGlobalFiles(ctx) {
      // Dynamic injection: the right Sidebar's registry may be provided after
      // this plugin activates, and a composition without it must keep working
      // (the native tree and the DOM enhancements above never depend on it).
      if (typeof ctx.inject !== 'function') return
      ctx.inject(['sidebarRightTabs', 'slots'], function (scope) {
        var registry = scope.sidebarRightTabs
        if (!registry || typeof registry.register !== 'function') return
        scope.effect(function () {
          try {
            var __reg = registry.register({
              id: FILES_TAKEOVER_ID,
              kind: 'files',
              title: function () { return L('文件', 'Files') },
              // The guide entry is what "New tab" lists and what seeds the
              // default page of an empty panel: without it the column opens
              // blank and the files page cannot be reopened at all.
              guide: [{
                id: 'global-files',
                order: 10,
                title: function () { return L('文件', 'Files') },
                description: function () { return L('浏览任意文件夹（所有工作区共用）', 'Browse any folder (shared by every workspace)') },
              }],
            })
            return __reg
          } catch (error) {
            return undefined
          }
        }, 'dsh-native-file-ops: global files type')
        scope.effect(function () {
          return scope.slots.inject('sidebar.right.pane.tab', function () {
            return scope.slots.register({ name: 'sidebar.right.pane.tab', key: FILES_TAKEOVER_ID }, GlobalFilesBody)
          })
        }, 'dsh-native-file-ops: global files body')
      })
    }

    /**
     * The docked terminal follows the file browser: every terminal spawn
     * carries the browser root instead of the session cwd, so switching
     * workspace no longer changes where a new shell starts.
     */
    // A terminal pinned to the shared root must survive a workspace switch, so
    // every session's sidebar terminal is addressed to ONE pty key: the host
    // reuses the live handle (and replays its transcript) instead of spawning
    // a fresh shell per session.
    var SHARED_TERM_SESSION = '__nfo_shared_terminal__'
    var SHARED_TERM_TAB = 'shared'
    var TERM_CWD_KEY = 'dsh.files.termCwd'

    function readTermCwd() {
      try {
        var value = window.localStorage.getItem(TERM_CWD_KEY)
        return typeof value === 'string' && value.charAt(0) === '/' ? value : undefined
      } catch (error) { return undefined }
    }

    function writeTermCwd(path) {
      try { window.localStorage.setItem(TERM_CWD_KEY, path) } catch (error) { /* ignore */ }
    }

    /** UI-owned terminal tab ids of the on-screen session, in pane order. */
    function terminalTabIds() {
      var ids = []
      var service = currentCtx && typeof currentCtx.get === 'function' ? currentCtx.get('betterSidebar') : undefined
      if (!service || typeof service.getSnapshot !== 'function') return ids
      var snapshot = service.getSnapshot()
      var state = snapshot && snapshot.state
      if (!state) return ids
      var tabs = []
      function walk(node) {
        if (!node || typeof node !== 'object') return
        if (node.kind === 'leaf' && Array.isArray(node.tabs)) {
          for (var i = 0; i < node.tabs.length; i += 1) tabs.push(node.tabs[i])
          return
        }
        if (Array.isArray(node.children)) {
          for (var j = 0; j < node.children.length; j += 1) walk(node.children[j])
        }
      }
      walk(state.splits)
      walk(state.bottomSplits)
      if (Array.isArray(state.floats)) {
        for (var f = 0; f < state.floats.length; f += 1) {
          if (state.floats[f] && state.floats[f].tab) tabs.push(state.floats[f].tab)
        }
      }
      for (var k = 0; k < tabs.length; k += 1) {
        var tab = tabs[k]
        if (tab && tab.type === 'terminal' && String(tab.id).indexOf('agent:') !== 0) ids.push(tab.id)
      }
      return ids
    }

    /**
     * Which shared shell a terminal tab belongs to. Terminals are shared by
     * POSITION, not all at once: the n-th terminal of every session is the
     * same shell, so opening a second terminal gives a separate shell while
     * switching workspace still lands on the one you were using.
     */
    function sharedTerminalSlot(tabId) {
      var ids = terminalTabIds()
      var index = ids.indexOf(tabId)
      return index >= 0 ? index + 1 : 1
    }

    /**
     * The cwd of the shared shell. It must be STABLE across workspace switches
     * (the host respawns a terminal whose cwd changed), so an explicitly picked
     * root wins, then the cwd the shared shell was first started in, and only
     * on the very first attach the current session's workspace — which is then
     * remembered.
     */
    function sharedTerminalCwd() {
      var root = readRoot()
      if (root !== undefined) return root
      var stored = readTermCwd()
      if (stored !== undefined) return stored
      var state = ctxState(currentCtx)
      if (state === undefined || typeof state.cwd !== 'string' || state.cwd === '') return undefined
      writeTermCwd(state.cwd)
      return state.cwd
    }

    function installTerminalCwd() {
      var Native = window.WebSocket
      if (typeof Native !== 'function' || Native.__nfoCwd === true) return
      var Patched = function (url, protocols) {
        var next = url
        try {
          var cwd = sharedTerminalCwd()
          if (cwd !== undefined && typeof url === 'string' && url.indexOf('/sidebar/ws/terminal') !== -1 && url.indexOf('uuid=') === -1) {
            var parsed = new URL(url, window.location.href)
            var requestedTab = parsed.searchParams.get('tab') || ''
            parsed.searchParams.set('cwd', cwd)
            // Same pty for every workspace at the same position: switching
            // conversations reattaches instead of respawning (the host keys a
            // terminal by session + tab, so both are replaced here).
            parsed.searchParams.set('sessionId', SHARED_TERM_SESSION)
            parsed.searchParams.set('tab', SHARED_TERM_TAB + '-' + sharedTerminalSlot(requestedTab))
            next = parsed.toString()
          }
        } catch (error) { /* keep the original url */ }
        return protocols === undefined ? new Native(next) : new Native(next, protocols)
      }
      Patched.prototype = Native.prototype
      Patched.CONNECTING = 0
      Patched.OPEN = 1
      Patched.CLOSING = 2
      Patched.CLOSED = 3
      Patched.__nfoCwd = true
      window.WebSocket = Patched
    }

    exports.inject = ['sessions', 'locale', 'uiSession', 'slots']
    exports.apply = function (ctx) {
      currentCtx = ctx
      try { locale = ctx.locale.getSnapshot().active || 'en' } catch (error) { locale = 'en' }
      try { ctx.locale.subscribe(function () { try { locale = ctx.locale.getSnapshot().active || locale } catch (error) { /* ignore */ } }) } catch (error) { /* ignore */ }
      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.tab.document.actions', function () {
          return ctx.slots.register({
            name: 'sidebar.right.tab.document.actions',
            id: 'native-file-ops-edit',
            order: 20,
          }, DocEditAction)
        })
      }, 'dsh-native-file-ops: document edit action')
      registerGlobalFiles(ctx)
      installTerminalCwd()
      var style = document.createElement('style')
      style.dataset.plugin = 'dsh-native-file-ops'
      style.textContent = CSS
      document.head.appendChild(style)
      var observer = new MutationObserver(function () { markDraggable() })
      observer.observe(document.body, { childList: true, subtree: true })
      var autoObserver = new MutationObserver(function () { scheduleAutoOpenEditors() })
      autoObserver.observe(document.body, { childList: true, subtree: true })
      scheduleAutoOpenEditors()
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
          autoObserver.disconnect()
          if (autoFrame !== null) {
            window.clearTimeout(autoFrame)
            autoFrame = null
          }
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
