// FR-09 notifications for every role. Owner: Jan Russel
import { api } from '../api.js'
import { refreshUnread, startPage } from '../app.js'
import { $, esc, formatDateTime } from '../ui.js'

await startPage()

async function load() {
  const list = $('#list')
  try {
    const d = await api('/notifications/list.php')
    $('#mark-all').classList.toggle('d-none', !d.unread_count)
    list.innerHTML = d.items.length
      ? d.items
          .map(
            (n) => `<li><button class="notif-row ${n.is_read ? '' : 'is-unread'}" data-id="${n.id}" data-read="${n.is_read ? 1 : 0}" data-report="${n.report_id ?? ''}">
              <strong class="d-block">${esc(n.title)}</strong>
              <span class="d-block">${esc(n.message)}</span>
              <span class="small text-secondary">${esc(formatDateTime(n.date))}</span></button></li>`,
          )
          .join('')
      : '<li class="text-secondary">No notifications yet.</li>'
    list.querySelectorAll('button[data-id]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (b.dataset.read === '0') await api('/notifications/read.php', { method: 'POST', body: { id: Number(b.dataset.id) } }).catch(() => {})
        if (b.dataset.report) location.href = `report.php?id=${b.dataset.report}`
        else {
          load()
          refreshUnread()
        }
      }),
    )
  } catch (e) {
    list.innerHTML = `<li class="alert alert-danger">${esc(e.message)}</li>`
  }
}
$('#mark-all').addEventListener('click', async () => {
  await api('/notifications/read.php', { method: 'POST', body: { all: true } })
  load()
  refreshUnread()
})
load()
