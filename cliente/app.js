// ============================================================
// La Casa de Pastel — Site do Cliente (app.js)
// ============================================================

let menuProducts = [];
let clientCart = [];
let selectedTipo = 'retirada';
let selectedPay = 'Dinheiro';
let currentTrackingId = null;
let trackingUnsub = null;

// ============================================================
// --- VERIFICAR STATUS DA LOJA ---
// ============================================================

async function checkStoreStatus() {
    const statusEl = document.getElementById('store-status');
    const statusText = document.getElementById('status-text');
    const closedOverlay = document.getElementById('store-closed');
    const mainContent = document.getElementById('main-content');

    try {
        const settings = await FireDB.loadSettings();
        if (!settings) {
            setStoreOpen(statusEl, statusText);
            return;
        }

        // Override manual  
        if (settings.storeOverride) {
            setStoreOpen(statusEl, statusText);
            return;
        }

        // Verifica horário
        const hours = settings.storeHours;
        if (!hours) {
            setStoreOpen(statusEl, statusText);
            return;
        }

        const now = new Date();
        const dayConfig = hours[now.getDay()];
        if (!dayConfig || !dayConfig.enabled) {
            setStoreClosed(statusEl, statusText, closedOverlay, mainContent, hours);
            return;
        }

        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [openH, openM] = dayConfig.open.split(':').map(Number);
        const [closeH, closeM] = dayConfig.close.split(':').map(Number);

        if (currentTime >= (openH * 60 + openM) && currentTime <= (closeH * 60 + closeM)) {
            setStoreOpen(statusEl, statusText);
        } else {
            setStoreClosed(statusEl, statusText, closedOverlay, mainContent, hours);
        }
    } catch (e) {
        console.warn('Erro ao verificar status da loja:', e.message);
        setStoreOpen(statusEl, statusText);
    }
}

function setStoreOpen(statusEl, statusText) {
    if (statusEl) statusEl.className = 'status-badge status-open';
    if (statusText) statusText.textContent = 'Aberto agora';
}

function setStoreClosed(statusEl, statusText, overlay, main, hours) {
    if (statusEl) statusEl.className = 'status-badge status-closed';
    if (statusText) statusText.textContent = 'Fechado';

    if (overlay) overlay.style.display = 'flex';
    if (main) main.style.display = 'none';

    // Mostra horários
    const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const list = document.getElementById('closed-hours-list');
    if (list && hours) {
        list.innerHTML = hours.map((h, i) => `
            <div class="hours-row ${h.enabled ? '' : 'hours-disabled'}">
                <span>${DAYS[i]}</span>
                <span>${h.enabled ? `${h.open} - ${h.close}` : 'Fechado'}</span>
            </div>
        `).join('');
    }
}

// ============================================================
// --- CARREGAR CARDÁPIO ---
// ============================================================

async function loadMenu() {
    const grid = document.getElementById('menu-grid');
    if (grid) grid.innerHTML = '<div class="loading-menu"><i class="fa-solid fa-spinner fa-spin"></i><p>Carregando cardápio...</p></div>';

    try {
        console.log('Tentando carregar produtos do Firebase...');
        const products = await FireDB.loadProducts();

        if (products && products.length > 0) {
            menuProducts = products;
            console.log('Produtos carregados do Firebase:', menuProducts.length);
        } else {
            console.warn('Firebase retornou zero produtos.');
            const stored = localStorage.getItem('lacasa_products');
            if (stored) {
                menuProducts = JSON.parse(stored);
                console.log('Usando produtos do localStorage (fallback):', menuProducts.length);
            }
        }
    } catch (e) {
        console.error('Erro ao acessar Firebase:', e.message);
        const stored = localStorage.getItem('lacasa_products');
        if (stored) {
            menuProducts = JSON.parse(stored);
        }
    }

    // Filtra só ativos e com estoque
    menuProducts = menuProducts.filter(p => p.active !== false && p.stock > 0);

    renderCategoryTabs();
    renderMenu();
}

function renderCategoryTabs() {
    const tabs = document.getElementById('category-tabs');
    if (!tabs) return;

    const categories = [...new Set(menuProducts.map(p => p.category))];
    const categoryEmojis = {
        'Pastéis': '🥟',
        'Bebidas': '🥤',
        'Porções': '🍟',
        'Outros': '🍽️'
    };

    tabs.innerHTML = `
        <button class="cat-tab active" onclick="filterCategory('todos')">🍽️ Todos</button>
        ${categories.map(cat => `
            <button class="cat-tab" onclick="filterCategory('${cat}')">${categoryEmojis[cat] || '🍽️'} ${cat}</button>
        `).join('')}
    `;
}

function filterCategory(cat) {
    document.querySelectorAll('.cat-tab').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
    renderMenu(cat === 'todos' ? '' : cat);
}

function renderMenu(categoryFilter = '') {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;

    const filtered = categoryFilter
        ? menuProducts.filter(p => p.category === categoryFilter)
        : menuProducts;

    if (filtered.length === 0) {
        const isConfigMissing = firebaseConfig.apiKey.includes('SUA_API_KEY');
        grid.innerHTML = `
            <div class="empty-menu">
                <i class="fa-solid fa-box-open"></i>
                <h3>${isConfigMissing ? 'Firebase não configurado' : 'Cardápio em breve'}</h3>
                <p>${isConfigMissing
                ? 'O sistema ainda está usando as chaves de exemplo.'
                : 'Não encontramos itens ativos no momento. Verifique o estoque no PDV.'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const pid = String(p.id);
        const inCart = clientCart.find(c => String(c.id) === pid);
        return `
            <div class="menu-card" style="border-left: 3px solid ${p.color || '#e50914'};">
                <div class="menu-card-body">
                    <div class="menu-card-icon" style="color:${p.color || '#e50914'};">
                        <i class="${p.icon || 'fa-solid fa-utensils'}"></i>
                    </div>
                    <div class="menu-card-info">
                        <h3>${p.name}</h3>
                        <span class="menu-category">${p.category}</span>
                    </div>
                    <div class="menu-card-price">R$ ${p.price.toFixed(2).replace('.', ',')}</div>
                </div>
                <div class="menu-card-actions">
                    ${inCart ? `
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="changeQty('${pid}', -1)">−</button>
                            <span class="qty-display">${inCart.qty}</span>
                            <button class="qty-btn" onclick="changeQty('${pid}', 1)">+</button>
                        </div>
                    ` : `
                        <button class="add-btn" onclick="addToCart('${pid}')">
                            <i class="fa-solid fa-plus"></i> Adicionar
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// --- CARRINHO ---
// ============================================================

function addToCart(productId) {
    const pid = String(productId);
    const product = menuProducts.find(p => String(p.id) === pid);
    if (!product) return;

    const existing = clientCart.find(c => String(c.id) === pid);
    if (existing) {
        existing.qty++;
    } else {
        clientCart.push({ id: pid, name: product.name, price: product.price, qty: 1 });
    }

    updateCartUI();
    renderMenu(getCurrentCategory());
}

function changeQty(productId, delta) {
    const pid = String(productId);
    const item = clientCart.find(c => String(c.id) === pid);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        clientCart = clientCart.filter(c => String(c.id) !== pid);
    }

    updateCartUI();
    renderMenu(getCurrentCategory());
}

function getCurrentCategory() {
    const active = document.querySelector('.cat-tab.active');
    if (!active) return '';
    const text = active.textContent.trim();
    if (text.includes('Todos')) return '';
    const parts = text.split(' ');
    return parts.slice(1).join(' ');
}

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    const total = clientCart.reduce((sum, c) => sum + c.qty, 0);

    if (badge) {
        badge.textContent = total;
        badge.style.display = total > 0 ? 'flex' : 'none';
    }

    renderCartItems();
}

function renderCartItems() {
    const container = document.getElementById('client-cart-items');
    const footer = document.getElementById('cart-footer');
    if (!container) return;

    if (clientCart.length === 0) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fa-solid fa-basket-shopping empty-icon"></i>
                <p>Seu carrinho está vazio</p>
                <span>Adicione itens do cardápio</span>
            </div>
        `;
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'block';

    container.innerHTML = clientCart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <span class="cart-item-name">${item.name}</span>
                <span class="cart-item-price">R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="cart-item-controls">
                <button class="qty-btn-sm" onclick="changeQty('${item.id}', -1)">−</button>
                <span>${item.qty}</span>
                <button class="qty-btn-sm" onclick="changeQty('${item.id}', 1)">+</button>
            </div>
        </div>
    `).join('');

    // Update total
    const totalValue = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    const totalEl = document.getElementById('client-cart-total');
    if (totalEl) totalEl.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
}

function openCart() {
    document.getElementById('cart-overlay').classList.add('active');
    document.getElementById('cart-drawer').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cart-overlay').classList.remove('active');
    document.getElementById('cart-drawer').classList.remove('active');
    document.body.style.overflow = '';
}

// ============================================================
// --- CHECKOUT ---
// ============================================================

function goToCheckout() {
    if (clientCart.length === 0) return;
    closeCart();

    const subtotal = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    document.getElementById('checkout-subtotal').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    document.getElementById('checkout-total').textContent = `R$ ${subtotal.toFixed(2).replace('.', ',')}`;

    // Reset selections
    selectedTipo = 'retirada';
    selectedPay = 'Dinheiro';
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tipo-btn[data-tipo="retirada"]').classList.add('active');
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.pay-btn[data-pay="Dinheiro"]').classList.add('active');

    document.getElementById('endereco-section').style.display = 'none';
    document.getElementById('mesa-section').style.display = 'none';
    document.getElementById('troco-section').style.display = 'block';
    const taxaLine = document.getElementById('taxa-line');
    if (taxaLine) taxaLine.style.display = 'none';

    // Clear inputs
    const inputs = ['nome-input', 'whatsapp-input', 'endereco-input', 'mesa-input', 'troco-input'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    document.getElementById('checkout-modal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCheckout() {
    document.getElementById('checkout-modal').style.display = 'none';
    document.body.style.overflow = '';
}

function selectTipo(tipo) {
    selectedTipo = tipo;
    document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tipo-btn[data-tipo="${tipo}"]`).classList.add('active');

    document.getElementById('endereco-section').style.display = tipo === 'entrega' ? 'block' : 'none';
    document.getElementById('mesa-section').style.display = tipo === 'local' ? 'block' : 'none';

    // Taxa de entrega
    const taxaLine = document.getElementById('taxa-line');
    if (tipo === 'entrega') {
        taxaLine.style.display = 'flex';
        document.getElementById('checkout-taxa').textContent = 'A combinar';
    } else {
        taxaLine.style.display = 'none';
    }
}

function selectPay(pay) {
    selectedPay = pay;
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.pay-btn[data-pay="${pay}"]`).classList.add('active');

    document.getElementById('troco-section').style.display = pay === 'Dinheiro' ? 'block' : 'none';
}

async function submitOrder() {
    const nome = document.getElementById('nome-input').value.trim();
    const whatsapp = document.getElementById('whatsapp-input').value.trim();

    if (!nome) {
        alert('Por favor, preencha seu nome.');
        document.getElementById('nome-input').focus();
        return;
    }

    if (!whatsapp) {
        alert('Por favor, preencha seu WhatsApp.');
        document.getElementById('whatsapp-input').focus();
        return;
    }

    if (selectedTipo === 'entrega') {
        const endereco = document.getElementById('endereco-input').value.trim();
        if (!endereco) {
            alert('Por favor, preencha o endereço de entrega.');
            document.getElementById('endereco-input').focus();
            return;
        }
    }

    const subtotal = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);

    const order = {
        items: clientCart.map(c => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
        total: subtotal,
        tipo: selectedTipo,
        pagamento: selectedPay,
        contato: `${nome} - ${whatsapp}`,
        nome: nome,
        whatsapp: whatsapp,
        endereco: selectedTipo === 'entrega' ? document.getElementById('endereco-input').value.trim() : null,
        mesa: selectedTipo === 'local' ? document.getElementById('mesa-input').value.trim() : null,
        trocoParaValor: selectedPay === 'Dinheiro' ? parseFloat(document.getElementById('troco-input').value) || null : null,
        status: 'pendente'
    };

    // Checa auto-approve
    try {
        const settings = await FireDB.loadSettings();
        if (settings?.autoApprove) {
            order.status = 'aprovado';
        }
    } catch (e) { }

    // Desativa botão para evitar duplo envio
    const submitBtn = document.querySelector('.submit-order-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    }

    try {
        const orderId = await FireDB.createOrder(order);
        closeCheckout();
        showTracking(orderId);
    } catch (e) {
        alert('Erro ao enviar pedido. Tente novamente.\n' + e.message);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Pedido';
        }
    }
}

// ============================================================
// --- TRACKING ---
// ============================================================

function showTracking(orderId) {
    currentTrackingId = orderId;
    document.getElementById('tracking-order-id').textContent = `Pedido #${orderId.slice(-4).toUpperCase()}`;
    document.getElementById('tracking-modal').style.display = 'flex';
    document.getElementById('main-content').style.display = 'none';
    document.body.style.overflow = 'hidden';

    // Limpa cart
    clientCart = [];
    updateCartUI();

    // Escuta mudanças no pedido
    if (trackingUnsub) trackingUnsub();
    trackingUnsub = FireDB.onOrderStatus(orderId, (data) => {
        renderTrackingSteps(data.status);
    });
}

function renderTrackingSteps(currentStatus) {
    const steps = ['pendente', 'aprovado', 'preparando', 'pronto', 'entregue'];
    const labels = {
        pendente: { icon: 'fa-clock', text: 'Aguardando aprovação' },
        aprovado: { icon: 'fa-circle-check', text: 'Aprovado' },
        preparando: { icon: 'fa-fire', text: 'Preparando' },
        pronto: { icon: 'fa-bell', text: 'Pronto!' },
        entregue: { icon: 'fa-flag-checkered', text: 'Concluído' }
    };

    const currentIdx = steps.indexOf(currentStatus);
    const container = document.getElementById('tracking-steps');
    const msgEl = document.getElementById('tracking-msg');

    if (currentStatus === 'recusado') {
        container.innerHTML = `
            <div class="tracking-step refused">
                <i class="fa-solid fa-circle-xmark"></i>
                <span>Pedido recusado pela loja</span>
            </div>
        `;
        msgEl.textContent = 'Infelizmente seu pedido não pôde ser aceito. Tente novamente ou entre em contato.';
        return;
    }

    const messages = {
        pendente: 'Aguardando confirmação da loja...',
        aprovado: 'A loja aceitou seu pedido! Preparando em breve...',
        preparando: 'Seu pedido está sendo preparado! 🔥',
        pronto: 'Seu pedido está pronto! 🎉',
        entregue: 'Pedido concluído! Obrigado pela preferência! ❤️'
    };
    msgEl.textContent = messages[currentStatus] || '';

    container.innerHTML = steps.map((step, idx) => {
        const info = labels[step];
        let stateClass = 'pending';
        if (idx < currentIdx) stateClass = 'done';
        if (idx === currentIdx) stateClass = 'current';
        return `
            <div class="tracking-step ${stateClass}">
                <div class="step-icon"><i class="fa-solid ${info.icon}"></i></div>
                <span>${info.text}</span>
            </div>
        `;
    }).join('');
}

function resetToMenu() {
    if (trackingUnsub) { trackingUnsub(); trackingUnsub = null; }
    currentTrackingId = null;
    document.getElementById('tracking-modal').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    document.body.style.overflow = '';
}

// ============================================================
// --- INIT ---
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await checkStoreStatus();
        await loadMenu();
    } catch (e) {
        console.error('Error initializing:', e);
        // Try loading from localStorage as fallback
        const stored = localStorage.getItem('lacasa_products');
        if (stored) {
            menuProducts = JSON.parse(stored).filter(p => p.active !== false && p.stock > 0);
            renderCategoryTabs();
            renderMenu();
        }
    }
});
