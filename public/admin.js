// public/admin.js
// Sets up the Admin Dashboard buttons and timestamp display.
// Tolerates endpoints that sometimes return an empty body or non‑JSON.
document.addEventListener('DOMContentLoaded', () => {
    // --- Element refs ---------------------------------------------------------
    const syncBtn = document.getElementById('syncBtn');
    const revertBtn = document.getElementById('rollbackBtn');
    const msgEl = document.getElementById('message');
    const syncStampEl = document.getElementById('sync-timestamp');
    const rollStampEl = document.getElementById('rollback-timestamp');
    // --- Helpers --------------------------------------------------------------
    /** Format an ISO string to Pacific Time, e.g. “July 12 2025, 8:33 PM PDT”. */
    function toPacific(iso) {
        if (!iso) return '—';
        const d = new Date(iso); // treat incoming string as UTC
        const opts = {
            timeZone: 'America/Los_Angeles',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        };
        const formatted = new Intl.DateTimeFormat('en-US', opts).format(d);
        // Add PT label (PDT/PST depending on date)
        const isDST = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            timeZoneName: 'short',
        })
            .formatToParts(d)
            .find(p => p.type === 'timeZoneName').value; // "PDT" | "PST"
        return `${formatted} ${isDST}`;
    }
    /** Read JSON only when the response advertises it; otherwise return {}. */
    async function maybeJson(res) {
        const type = res.headers.get('content-type') || '';
        return type.includes('application/json') ? res.json() : {};
    }
    function setLoadingState(isLoading) {
        syncBtn.disabled = revertBtn.disabled = isLoading;
        if (isLoading && msgEl) msgEl.textContent = 'Working…';
    }
    // --- Network calls --------------------------------------------------------
    async function refreshStatus() {
        try {
            const res = await fetch('/admin/status');
            const data = await maybeJson(res);
            syncStampEl.textContent = toPacific(data.lastSync);
            rollStampEl.textContent = toPacific(data.lastRollback);
        } catch (err) {
            console.error('Status fetch failed', err);
            if (msgEl) msgEl.textContent = 'Unable to load status';
        }
    }
    async function doSync() {
        setLoadingState(true);
        try {
            const res = await fetch('/admin/sync', { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await maybeJson(res);
            if (msgEl) msgEl.textContent = data.message || 'Sync complete';
            await refreshStatus();
        } catch (err) {
            console.error(err);
            if (msgEl) msgEl.textContent = 'Sync failed';
        } finally {
            setLoadingState(false);
        }
    }
    async function doRevert() {
        setLoadingState(true);
        try {
            const res = await fetch('/admin/revert', { method: 'POST' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await maybeJson(res);
            if (msgEl) msgEl.textContent = data.message || 'Rollback complete';
            await refreshStatus();
        } catch (err) {
            console.error(err);
            if (msgEl) msgEl.textContent = 'Rollback failed';
        } finally {
            setLoadingState(false);
        }
    }
    // --- Wire up buttons & initial load --------------------------------------
    syncBtn.addEventListener('click', doSync);
    revertBtn.addEventListener('click', doRevert);
    refreshStatus();
    setInterval(refreshStatus, 60000); // Refresh every 60s
});