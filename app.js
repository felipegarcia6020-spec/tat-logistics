// ==========================================
// ROUTELOGIX TaT - MAPLIBRE GL INIT FOR MOBILE & PC
// ==========================================

let map = null;
let stopMarkers = [];
let activeDrawerTab = 'stops';
let drawerOpen = false;
let currentFilter = 'all';
let pendingStopIdForPayment = null;

let routesData = JSON.parse(localStorage.getItem('tat_routes')) || [
    {
        id: 'ruta-principal',
        name: 'Ruta 01 - Plásticos Norte',
        warehouseStart: 'Bodega Central Desechables',
        warehouseEnd: 'Bodega Central Desechables',
        stops: [],
        expenses: [],
        denominations: { 
            100000: 0, 50000: 0, 20000: 0, 10000: 0, 5000: 0, 2000: 0, 1000: 0, coins: 0 
        }
    }
];

let activeRouteId = routesData[0].id;

window.addEventListener('DOMContentLoaded', () => {
    checkTrialAndFreemiumLimits();
    checkUserSession();
    initMap();
});

// ==========================================
// 1. AUTENTICACIÓN
// ==========================================
function checkTrialAndFreemiumLimits() {
    let installDate = localStorage.getItem('tat_install_timestamp');
    const TRIAL_DAYS = 3;
    if (!installDate) {
        installDate = new Date().getTime();
        localStorage.setItem('tat_install_timestamp', installDate);
    }
    const now = new Date().getTime();
    const elapsedDays = (now - parseInt(installDate)) / (1000 * 60 * 60 * 24);
    const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
    const badge = document.getElementById('trial-badge');
    if (badge) badge.textContent = `Licencia Free: ${daysLeft} días`;
}

function checkUserSession() {
    const session = localStorage.getItem('tat_user_session');
    if (!session) {
        const loginModal = document.getElementById('modal-login');
        if (loginModal) loginModal.classList.remove('hidden');
        setCrosshairVisible(false);
    } else {
        setCrosshairVisible(true);
    }
}

function handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const pass = document.getElementById('login-pass').value;

    const registeredUsers = JSON.parse(localStorage.getItem('tat_registered_users')) || [];
    const foundUser = registeredUsers.find(u => u.email.toLowerCase() === email && u.pass === pass);

    if (foundUser || (email === 'admin@routelogix.com' && pass === '123456')) {
        const sessionData = foundUser || { name: 'Administrador', email: email, role: 'driver' };
        localStorage.setItem('tat_user_session', JSON.stringify(sessionData));
        document.getElementById('modal-login').classList.add('hidden');
        setCrosshairVisible(true);
        if (map) { 
            map.resize(); 
            renderRouteMarkersAndPath(); 
        }
        openDrawer('stops');
    } else {
        alert("❌ Correo o contraseña incorrectos.");
    }
}

function openRegisterModal() {
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('modal-register').classList.remove('hidden');
}

function backToLogin() {
    document.getElementById('modal-register').classList.add('hidden');
    document.getElementById('modal-login').classList.remove('hidden');
}

function handleRegisterSubmit(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const phone = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-pass').value;

    let registeredUsers = JSON.parse(localStorage.getItem('tat_registered_users')) || [];
    if (registeredUsers.some(u => u.email === email)) {
        alert("⚠️ Este correo ya está registrado.");
        return;
    }

    const newUser = { name: username, email, phone, pass, role: 'driver' };
    registeredUsers.push(newUser);
    localStorage.setItem('tat_registered_users', JSON.stringify(registeredUsers));
    localStorage.setItem('tat_user_session', JSON.stringify(newUser));

    document.getElementById('modal-register').classList.add('hidden');
    setCrosshairVisible(true);
    alert("✅ ¡Cuenta creada con éxito!");
    if (map) { map.resize(); renderRouteMarkersAndPath(); }
    openDrawer('stops');
}

function logoutSession() {
    localStorage.removeItem('tat_user_session');
    closeDrawerCompletely();
    setCrosshairVisible(false);
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
    document.getElementById('modal-login').classList.remove('hidden');
}

// ==========================================
// 2. INICIALIZACIÓN DE MAPLIBRE GL (MOBILE READY)
// ==========================================
function initMap() {
    if (map) return;

    map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-74.050, 4.675],
        zoom: 13,
        attributionControl: false,
        interactive: true,
        dragPan: true,
        scrollZoom: true,
        boxZoom: true,
        doubleClickZoom: true,
        touchZoomRotate: true
    });

    map.boxZoom.enable();
    map.dragRotate.enable();
    map.touchZoomRotate.enable();

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
        map.resize();
        if (localStorage.getItem('tat_user_session')) {
            renderRouteMarkersAndPath();
        }
    });

    // Forzar redimensionamiento múltiple para WebView móvil
    setTimeout(() => { if (map) map.resize(); }, 300);
    setTimeout(() => { if (map) map.resize(); }, 1000);

    window.addEventListener('resize', () => {
        if (map) map.resize();
    });
}

async function searchLocation() {
    const query = document.getElementById('map-search-input').value.trim();
    if (!query) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const results = await response.json();

        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lon = parseFloat(results[0].lon);
            map.flyTo({ center: [lon, lat], zoom: 16 });

            new maplibregl.Popup()
                .setLngLat([lon, lat])
                .setHTML(`<div style='color:white; font-size:11px; font-weight:bold;'>📍 ${results[0].display_name}</div>`)
                .addTo(map);
        } else {
            alert("❌ No se encontró la ubicación ingresada.");
        }
    } catch (e) {
        alert("⚠️ Error de red al buscar el lugar.");
    }
}

function handleSearchKeyDown(e) {
    if (e.key === 'Enter') searchLocation();
}

function centerOnUserGPS() {
    if (!navigator.geolocation) { alert("Geolocalización no soportada."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        map.flyTo({ center: [lng, lat], zoom: 16 });
        new maplibregl.Popup().setLngLat([lng, lat]).setHTML("<div style='color:white; font-size:11px; font-weight:bold;'>📍 Ubicación GPS Activa</div>").addTo(map);
    }, () => { alert("⚠️ Activa los permisos de ubicación GPS."); }, { enableHighAccuracy: true, timeout: 10000 });
}

// ==========================================
// 3. PANELES Y GESTIÓN DE RUTAS
// ==========================================
function setCrosshairVisible(visible) {
    const crosshair = document.getElementById('map-crosshair-container');
    if (crosshair) {
        if (visible && localStorage.getItem('tat_user_session')) crosshair.classList.remove('crosshair-hidden');
        else crosshair.classList.add('crosshair-hidden');
    }
}

function openDrawer(tabName) {
    const drawer = document.getElementById('bottom-drawer');
    const filters = document.getElementById('drawer-filters');
    activeDrawerTab = tabName;

    if (tabName === 'stops' || tabName === 'routes' || tabName === 'settings') {
        if (tabName === 'stops') filters.classList.remove('hidden');
        else filters.classList.add('hidden');

        renderDrawerContent();
        drawer.classList.add('drawer-open');
        drawerOpen = true;
        setCrosshairVisible(false);
    }
}

function closeDrawerCompletely() {
    const drawer = document.getElementById('bottom-drawer');
    if (drawer) {
        drawer.classList.remove('drawer-open');
    }
    drawerOpen = false;
    setCrosshairVisible(true);
    setTimeout(() => { if (map) map.resize(); }, 300);
}

function openFinanceModal() {
    closeDrawerCompletely();
    renderFinanceModalContent();
    const modal = document.getElementById('modal-finance');
    if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
    }
    setCrosshairVisible(false);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    setCrosshairVisible(true);
    setTimeout(() => { if (map) map.resize(); }, 250);
}

function filterStops(status) {
    currentFilter = status;
    renderDrawerContent();
}

function renderFinanceModalContent() {
    const body = document.getElementById('finance-modal-body');
    const currentRoute = routesData.find(r => r.id === activeRouteId);
    if (!currentRoute) return;

    const totalClients = currentRoute.stops.length;
    const deliveredClients = currentRoute.stops.filter(s => s.status === 'delivered').length;
    const totalExpected = currentRoute.stops.reduce((acc, s) => acc + (s.value || 0), 0);
    const totalCollected = currentRoute.stops.reduce((acc, s) => acc + (s.collected || 0), 0);
    const totalCash = currentRoute.stops.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + (s.collected || 0), 0);
    const totalDigital = currentRoute.stops.filter(s => s.paymentMethod === 'nequi' || s.paymentMethod === 'breve').reduce((acc, s) => acc + (s.collected || 0), 0);
    const totalExpenses = (currentRoute.expenses || []).reduce((acc, exp) => acc + exp.amount, 0);
    const netCash = totalCash - totalExpenses;

    body.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span class="block text-slate-400 text-[9px]">Total Clientes</span>
                    <span class="text-base font-extrabold text-white">${totalClients}</span>
                </div>
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span class="block text-slate-400 text-[9px]">Clientes Cobrados</span>
                    <span class="text-base font-extrabold text-emerald-400">${deliveredClients}</span>
                </div>
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span class="block text-slate-400 text-[9px]">Efectivo Neto</span>
                    <span class="text-xs font-extrabold text-amber-400">$${netCash.toLocaleString()}</span>
                </div>
            </div>

            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
                <div class="flex justify-between"><span class="text-slate-400">Total Ruta Esperado:</span> <strong class="text-white">$${totalExpected.toLocaleString()}</strong></div>
                <div class="flex justify-between"><span class="text-slate-400">Total Recaudado Real:</span> <strong class="text-emerald-400">$${totalCollected.toLocaleString()}</strong></div>
                <div class="flex justify-between"><span class="text-slate-400">💵 Efectivo:</span> <strong class="text-white">$${totalCash.toLocaleString()}</strong></div>
                <div class="flex justify-between"><span class="text-slate-400">📱 Nequi / Breve:</span> <strong class="text-sky-400">$${totalDigital.toLocaleString()}</strong></div>
                <div class="flex justify-between border-t border-slate-800 pt-1"><span class="text-rose-400">📉 Gastos Ruta:</span> <strong class="text-rose-400">-$${totalExpenses.toLocaleString()}</strong></div>
            </div>

            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <h4 class="font-bold text-slate-200 text-[11px]"><i class="fa-solid fa-receipt text-rose-400 mr-1"></i> Registrar Gasto Diario</h4>
                <div class="flex gap-1.5">
                    <input type="text" id="expense-concept" placeholder="Concepto (Ej. Peaje)" class="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-white">
                    <input type="number" id="expense-amount" placeholder="Valor ($)" class="w-24 bg-slate-900 border border-slate-700 rounded p-1.5 text-white">
                    <button onclick="addExpense()" class="bg-rose-600 text-white px-3 rounded font-bold">Añadir</button>
                </div>
                <div class="space-y-1 pt-1 max-h-20 overflow-y-auto">
                    ${(currentRoute.expenses || []).map((exp) => `
                        <div class="flex justify-between text-[10px] bg-slate-900 p-1.5 rounded">
                            <span>${exp.concept}</span>
                            <span class="text-rose-400 font-bold">-$${exp.amount.toLocaleString()}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <h4 class="font-bold text-slate-200 text-[11px]"><i class="fa-solid fa-coins text-amber-400 mr-1"></i> Conteo por Denominación</h4>
                <div class="grid grid-cols-2 gap-2 text-[10px]">
                    ${Object.keys(currentRoute.denominations).map(denom => `
                        <div class="flex items-center justify-between bg-slate-900 p-1.5 rounded">
                            <span class="text-slate-300">${denom === 'coins' ? 'Monedas' : '$' + parseInt(denom).toLocaleString()}</span>
                            <input type="number" min="0" value="${currentRoute.denominations[denom]}" onchange="updateDenomination('${denom}', this.value)" class="w-14 bg-slate-950 border border-slate-700 text-center rounded p-1 text-white font-bold">
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

function renderDrawerContent() {
    const title = document.getElementById('drawer-title');
    const body = document.getElementById('drawer-content-body');
    body.innerHTML = '';
    const currentRoute = routesData.find(r => r.id === activeRouteId);
    if (!currentRoute) return;

    if (activeDrawerTab === 'stops') {
        title.textContent = "Paradas y Entregas";
        if (currentRoute.stops.length === 0) {
            body.innerHTML = `<div class="text-center text-slate-500 py-4 text-xs">No hay paradas. Arrastra el mapa y usa el botón (+) central para agregar clientes.</div>`;
            return;
        }

        let filteredStops = currentRoute.stops;
        if (currentFilter !== 'all') filteredStops = currentRoute.stops.filter(s => s.status === currentFilter);

        filteredStops.forEach((stop, index) => {
            let statusBadge = stop.status === 'delivered' 
                ? `<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold">Cobrado</span>`
                : stop.status === 'failed' 
                ? `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold">Rechazado</span>`
                : `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-2 py-0.5 rounded-full font-bold">Pendiente</span>`;

            const card = document.createElement('div');
            card.className = `p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2`;
            card.innerHTML = `
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-brand-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">${index + 1}</span>
                        <div>
                            <h4 class="text-xs font-bold text-white">${stop.name}</h4>
                            <p class="text-[10px] text-slate-400"><i class="fa-solid fa-location-dot text-brand-400 mr-1"></i>${stop.address}</p>
                        </div>
                    </div>
                    ${statusBadge}
                </div>
                <div class="text-[10px] text-slate-300 flex items-center justify-between bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono">
                    <span class="text-brand-300">${stop.invoice}</span>
                    <span class="text-emerald-400 font-bold">Factura: $${(stop.value || 0).toLocaleString()}</span>
                    <span>Cobrado: <strong class="text-white">$${(stop.collected || 0).toLocaleString()}</strong></span>
                </div>
                <div class="flex items-center justify-between pt-1 border-t border-slate-900">
                    <a href="https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}" target="_blank" class="px-2 py-1 bg-slate-800 text-cyan-300 rounded text-[10px]"><i class="fa-solid fa-map"></i> Maps</a>
                    <div class="flex gap-1.5">
                        <button onclick="centerMapOnStop(${stop.lat}, ${stop.lng})" class="px-2 py-1 bg-slate-800 text-slate-300 rounded text-[10px]">Ver</button>
                        <button onclick="promptPaymentModal(${stop.id})" class="px-2 py-1 bg-emerald-600 text-white font-bold rounded text-[10px]"><i class="fa-solid fa-cash-register mr-1"></i> Cobrar</button>
                    </div>
                </div>
            `;
            body.appendChild(card);
        });

    } else if (activeDrawerTab === 'routes') {
        title.textContent = "Seleccionar o Crear Ruta";
        body.innerHTML = `
            <div class="space-y-2 text-xs">
                <label class="block text-slate-400">Ruta Activa</label>
                <select id="route-select-drawer" onchange="changeActiveRoute(this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white">
                    ${routesData.map(r => `<option value="${r.id}" ${r.id === activeRouteId ? 'selected' : ''}>${r.name}</option>`).join('')}
                </select>
                <button onclick="createNewRoute()" class="w-full bg-brand-600 text-white font-bold py-2 rounded-xl mt-2"><i class="fa-solid fa-plus mr-1"></i> Crear Nueva Ruta</button>
            </div>
        `;
    } else if (activeDrawerTab === 'settings') {
        title.textContent = "Ajustes y Cuenta";
        const user = JSON.parse(localStorage.getItem('tat_user_session')) || {};
        body.innerHTML = `
            <div class="space-y-3 text-xs text-slate-300">
                <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                    <span class="block text-[10px] text-brand-400 font-bold uppercase">Conductor Conectado</span>
                    <p class="text-white font-semibold">${user.name || user.email}</p>
                </div>
                <button onclick="logoutSession()" class="w-full bg-amber-600/20 border border-amber-500/30 text-amber-300 font-semibold py-2 rounded-lg">Cerrar Sesión</button>
            </div>
        `;
    }
}

// ==========================================
// 4. ACCIONES DE RUTA Y PAGOS
// ==========================================
function promptPaymentModal(stopId) {
    pendingStopIdForPayment = stopId;
    const currentRoute = routesData.find(r => r.id === activeRouteId);
    const stop = currentRoute.stops.find(s => s.id === stopId);
    
    document.getElementById('payment-amount').value = stop.value || 0;
    document.getElementById('payment-method').value = 'cash';
    document.getElementById('container-proof-photo').classList.add('hidden');
    document.getElementById('modal-payment').classList.remove('hidden');
    setCrosshairVisible(false);
}

function togglePaymentProofField() {
    const method = document.getElementById('payment-method').value;
    const proofContainer = document.getElementById('container-proof-photo');
    if (method === 'nequi' || method === 'breve') proofContainer.classList.remove('hidden');
    else proofContainer.classList.add('hidden');
}

function handleConfirmPayment(e) {
    e.preventDefault();
    const method = document.getElementById('payment-method').value;
    const amount = parseFloat(document.getElementById('payment-amount').value) || 0;

    const currentRoute = routesData.find(r => r.id === activeRouteId);
    const stop = currentRoute.stops.find(s => s.id === pendingStopIdForPayment);
    if (stop) {
        stop.status = 'delivered';
        stop.collected = amount;
        stop.paymentMethod = method;
        localStorage.setItem('tat_routes', JSON.stringify(routesData));
        renderDrawerContent();
        renderRouteMarkersAndPath();
        alert("✅ ¡Cobro registrado con éxito!");
    }
    closeModal('modal-payment');
}

function renderRouteMarkersAndPath() {
    if (!map || !localStorage.getItem('tat_user_session')) return;
    stopMarkers.forEach(m => m.remove());
    stopMarkers = [];

    if (map.getSource('route-line')) {
        map.removeLayer('route-line-layer');
        map.removeSource('route-line');
    }

    const currentRoute = routesData.find(r => r.id === activeRouteId);
    if (!currentRoute) return;

    let coordinates = [];
    currentRoute.stops.forEach((stop, index) => {
        let bgHex = stop.status === 'delivered' ? '#10b981' : stop.status === 'failed' ? '#f43f5e' : '#f59e0b';
        
        const el = document.createElement('div');
        el.className = 'custom-stop-marker';
        el.style.backgroundColor = bgHex;
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.fontSize = '11px';
        el.innerText = index + 1;

        const popupContent = `
            <div style="min-width: 180px; font-family: 'Inter', sans-serif;">
                <div style="background-color: ${bgHex}; color: white; padding: 4px 8px; border-radius: 6px; font-weight: bold; font-size: 11px; margin-bottom: 6px;">Parada #${index + 1}</div>
                <h4 style="font-size: 12px; font-weight: bold; color: #fff; margin-bottom: 4px;">${stop.name}</h4>
                <p style="font-size: 10px; color: #94a3b8; margin-bottom: 6px;"><i class="fa-solid fa-location-dot"></i> ${stop.address}</p>
                <div style="font-size: 10px; background: #020617; padding: 6px; border-radius: 6px;">
                    <div>Factura: <strong style="color: #38bdf8;">$${(stop.value || 0).toLocaleString()}</strong></div>
                    <div>Cobrado: <strong style="color: #34d399;">$${(stop.collected || 0).toLocaleString()}</strong></div>
                </div>
            </div>
        `;

        const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupContent);
        const marker = new maplibregl.Marker({ element: el }).setLngLat([stop.lng, stop.lat]).setPopup(popup).addTo(map);
        stopMarkers.push(marker);
        coordinates.push([stop.lng, stop.lat]);
    });

    if (coordinates.length > 1 && map.isStyleLoaded()) {
        map.addSource('route-line', {
            'type': 'geojson',
            'data': { 'type': 'Feature', 'geometry': { 'type': 'LineString', 'coordinates': coordinates } }
        });
        map.addLayer({
            'id': 'route-line-layer', 'type': 'line', 'source': 'route-line',
            'layout': { 'line-join': 'round', 'line-cap': 'round' },
            'paint': { 'line-color': '#6366f1', 'line-width': 4, 'line-dasharray': [2, 2] }
        });
    }
}

function centerMapOnStop(lat, lng) {
    closeDrawerCompletely();
    if (map) map.flyTo({ center: [lng, lat], zoom: 16 });
}

function addExpense() {
    const concept = document.getElementById('expense-concept').value.trim();
    const amount = parseFloat(document.getElementById('expense-amount').value) || 0;
    if (!concept || amount <= 0) { alert("Ingresa un concepto y valor válido."); return; }

    const currentRoute = routesData.find(r => r.id === activeRouteId);
    if (!currentRoute.expenses) currentRoute.expenses = [];
    currentRoute.expenses.push({ concept, amount });
    localStorage.setItem('tat_routes', JSON.stringify(routesData));
    renderFinanceModalContent();
}

function updateDenomination(denom, val) {
    const currentRoute = routesData.find(r => r.id === activeRouteId);
    currentRoute.denominations[denom] = parseInt(val) || 0;
    localStorage.setItem('tat_routes', JSON.stringify(routesData));
    renderFinanceModalContent();
}

function createNewRoute() {
    const name = prompt("Nombre de la nueva ruta:");
    if (name) {
        const newR = { id: 'route-' + Date.now(), name, warehouseStart: 'Bodega Central', warehouseEnd: 'Bodega Central', stops: [], expenses: [], denominations: { 100000:0, 50000:0, 20000:0, 10000:0, 5000:0, 2000:0, 1000:0, coins:0 } };
        routesData.push(newR);
        activeRouteId = newR.id;
        localStorage.setItem('tat_routes', JSON.stringify(routesData));
        openDrawer('stops');
        alert("✅ Ruta creada correctamente.");
    }
}

function changeActiveRoute(id) {
    activeRouteId = id;
    renderDrawerContent();
    renderRouteMarkersAndPath();
}

function openNewRouteModalAtCenter() {
    closeDrawerCompletely();
    if (map) {
        const center = map.getCenter();
        window.openCoords = { lat: center.lat, lng: center.lng };
        document.getElementById('modal-new-stop').classList.remove('hidden');
        setCrosshairVisible(false);
    }
}

function handleCreateStop(e) {
    e.preventDefault();
    const name = document.getElementById('stop-client-name').value;
    const phone = document.getElementById('stop-client-phone').value;
    const invoice = document.getElementById('stop-invoice-num').value || 'FAC-00';
    const value = parseFloat(document.getElementById('stop-invoice-val').value) || 0;
    const address = document.getElementById('stop-address').value || 'Punto de Venta';

    const currentRoute = routesData.find(r => r.id === activeRouteId);
    if (currentRoute) {
        currentRoute.stops.push({
            id: Date.now(), name, phone, invoice, value, address, status: 'pending', collected: 0, paymentMethod: '',
            lat: window.openCoords?.lat || 4.675, lng: window.openCoords?.lng || -74.050
        });
        localStorage.setItem('tat_routes', JSON.stringify(routesData));
        renderDrawerContent();
        renderRouteMarkersAndPath();
        alert("✅ Parada creada y añadida a la ruta.");
    }
    closeModal('modal-new-stop');
    e.target.reset();
}

// ==========================================
// BLOQUEO ESTRICTO DE PULL-TO-REFRESH EN APK
// ==========================================
let touchStartY = 0;

document.addEventListener('touchstart', function(e) {
    touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
    if (!e.target.closest('#bottom-drawer') && !e.target.closest('#drawer-content-body') && !e.target.closest('#modal-finance')) {
        let touchEndY = e.touches[0].clientY;
        if (touchEndY > touchStartY) {
            if (e.cancelable) {
                e.preventDefault();
            }
        }
    }
}, { passive: false });