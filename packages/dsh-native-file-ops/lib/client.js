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
.nfo-doc-edit{display:flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary,#aaa);cursor:pointer}
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
.nfo-inplace-text{box-sizing:border-box;flex:1 1 auto;min-height:0;width:100%;padding:10px 14px;border:0;outline:none;resize:none;background:transparent;color:var(--dsw-alias-label-primary,#eee);font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;tab-size:2}
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



    // ── In-place text editing for the native document preview ─────────────
    // The native right-Sidebar preview is read-only. A small "edit" action in
    // the document header opens a raw-text editor (one textarea over the
    // fence-safe /sidebar/api/fs.read|fs.write carrier), saves in place, and
    // asks the preview to reload. Binary or truncated files are refused so a
    // truncated read can never overwrite the rest of the file.

    var editorOverlay = null

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
          var area = running.querySelector('.nfo-inplace-text')
          if (area !== null) area.focus()
          return
        }
      }
      sidebarCall(ctx, 'fs.read', { path: path }).then(function (value) {
        if (value.kind !== 'text') {
          toast(L('该文件不是文本，无法编辑', 'Not a text file'))
          return
        }
        if (value.truncated === true) {
          toast(L('文件过大，暂不支持在浏览器中编辑', 'File too large to edit here'))
          return
        }
        // Edit in place inside the document body when the action lives in a
        // real preview tab; the modal stays as the fallback for any other
        // invocation (e.g. a detached action surface).
        if (preview !== null) showInlineEditor(ctx, path, value.content, preview)
        else showTextEditor(ctx, path, value.content)
      }).catch(function (error) {
        toast(String(error && error.message ? error.message : error))
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
    function showInlineEditor(ctx, path, initial, preview) {
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

      var bar = document.createElement('div')
      bar.className = 'nfo-inplace-bar'
      var dirtyDot = document.createElement('span')
      dirtyDot.className = 'nfo-edit-dirty'
      var hint = document.createElement('span')
      hint.className = 'nfo-inplace-hint'
      hint.textContent = L('编辑中 · Ctrl+S 保存 · Esc 取消', 'Editing · Ctrl+S save · Esc cancel')
      var cancelButton = document.createElement('button')
      cancelButton.type = 'button'
      cancelButton.textContent = L('取消', 'Cancel')
      var saveButton = document.createElement('button')
      saveButton.type = 'button'
      saveButton.className = 'nfo-primary'
      saveButton.textContent = L('保存', 'Save')
      bar.appendChild(dirtyDot)
      bar.appendChild(hint)
      bar.appendChild(cancelButton)
      bar.appendChild(saveButton)

      var textarea = document.createElement('textarea')
      textarea.className = 'nfo-inplace-text'
      textarea.spellcheck = false
      textarea.wrap = 'off'
      textarea.value = initial
      textarea.setAttribute('aria-label', L('文件内容', 'File content'))

      box.appendChild(bar)
      box.appendChild(textarea)
      preview.appendChild(box)

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
        box.remove()
        preview.style.position = wasPosition
        preview.style.overflow = wasOverflow
      }
      box.__nfoCleanup = cleanup

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
        if (!box.isConnected) { cleanup(); return }
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
      cancelButton.addEventListener('click', close)
      saveButton.addEventListener('click', save)
      document.addEventListener('keydown', onKey, true)
      textarea.focus()
      textarea.setSelectionRange(0, 0)
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

    /** Double-click a text preview body to enter the in-place editor: the
     *  header pencil stays for discoverability, but editing needs no button. */
    function onPreviewDoubleClick(event) {
      var target = event.target
      if (!target || typeof target.closest !== 'function') return
      if (target.closest('a, button, input, textarea, select') !== null) return
      var body = target.closest('[data-textpreview-body]')
      if (body === null) return
      var host = body.closest('[data-sidebar-right-tab]')
      if (host === null) return
      var button = host.querySelector('button.nfo-doc-edit')
      if (button === null) return
      event.preventDefault()
      button.click()
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
      document.addEventListener('dblclick', onPreviewDoubleClick, true)
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
          document.removeEventListener('dblclick', onPreviewDoubleClick, true)
          closeMenu()
        }
      })
    }
    return module.exports
  },
})
