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

        // Verifica modo manual (3 estados: open, close, auto)
        const mode = settings.storeMode || 'auto';

        if (mode === 'open' || settings.storeOverride) {
            setStoreOpen(statusEl, statusText);
            return;
        }

        if (mode === 'close' || settings.storeForceClosed) {
            setStoreClosed(statusEl, statusText, closedOverlay, mainContent, settings.storeHours);
            return;
        }

        // Modo automático: verifica horário
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

    const categories = [...new Set(menuProducts.map(p => p.category))].filter(Boolean);

    tabs.innerHTML = `
        <button class="cat-tab active" onclick="filterCategory('todos')">Todos</button>
        ${categories.map(cat => `
            <button class="cat-tab" onclick="filterCategory('${cat}')">${cat}</button>
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

    const filtered = menuProducts.filter(p =>
        !p.isAddon &&
        p.category?.toLowerCase() !== 'adicional' &&
        (!categoryFilter || p.category === categoryFilter)
    );

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
                    <button class="add-btn" onclick="openItemModal('${pid}')">
                        <i class="fa-solid fa-plus"></i> Adicionar
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================================
// --- CARRINHO ---
// ============================================================

// ============================================================
// --- ITEM MODAL (ADDONS & OBS) ---
// ============================================================

let currentModalItem = null;
let currentModalQty = 1;

function openItemModal(productId) {
    const p = menuProducts.find(p => String(p.id) === String(productId));
    if (!p) return;

    currentModalItem = p;
    currentModalQty = 1;

    document.getElementById('item-modal-title').textContent = p.name;
    document.getElementById('item-modal-desc').textContent = p.category;
    document.getElementById('item-modal-obs').value = '';
    document.getElementById('item-modal-qty').textContent = currentModalQty;

    const addonsContainer = document.getElementById('item-modal-addons');
    addonsContainer.innerHTML = '';

    // Bebidas não possuem adicionais
    const isBebida = p.category?.toLowerCase() === 'bebida';
    const availableAddons = isBebida ? [] : menuProducts.filter(p => p.isAddon === true && p.active !== false && p.stock > 0);

    if (availableAddons.length > 0) {
        let addonsHTML = '<p style="font-weight:600; margin-bottom:8px;">Adicionais (Opcional)</p>';
        availableAddons.forEach((addon, idx) => {
            addonsHTML += `
                <label style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); padding:10px; border-radius:6px; margin-bottom:6px; cursor:pointer; border: 1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="addon-checkbox" data-id="${addon.id}" data-name="${addon.name}" data-price="${addon.price}" onchange="updateItemModalPrice()" style="width:18px; height:18px; accent-color:var(--color-primary);">
                        <span>${addon.name}</span>
                    </div>
                    <span style="color:var(--success-color);">+ R$ ${addon.price.toFixed(2).replace('.', ',')}</span>
                </label>
            `;
        });
        addonsContainer.innerHTML = addonsHTML;
    }

    updateItemModalPrice();
    document.getElementById('item-modal').style.display = 'flex';
}

function closeItemModal() {
    document.getElementById('item-modal').style.display = 'none';
    currentModalItem = null;
}

function changeItemModalQty(delta) {
    currentModalQty += delta;
    if (currentModalQty < 1) currentModalQty = 1;
    document.getElementById('item-modal-qty').textContent = currentModalQty;
    updateItemModalPrice();
}

function updateItemModalPrice() {
    if (!currentModalItem) return;

    let totalUnitPrice = currentModalItem.price;
    const checkboxes = document.querySelectorAll('.addon-checkbox:checked');
    checkboxes.forEach(cb => {
        totalUnitPrice += parseFloat(cb.getAttribute('data-price'));
    });

    const total = totalUnitPrice * currentModalQty;
    document.getElementById('item-modal-price').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function confirmItemOptions() {
    if (!currentModalItem) return;

    const obs = document.getElementById('item-modal-obs').value.trim();

    // Coleta addons selecionados
    // Coleta addons selecionados
    const selectedAddons = [];
    let extraPrice = 0;
    document.querySelectorAll('.addon-checkbox:checked').forEach(cb => {
        const id = cb.getAttribute('data-id');
        const name = cb.getAttribute('data-name');
        const price = parseFloat(cb.getAttribute('data-price'));
        selectedAddons.push({ id, name, price });
        extraPrice += price;
    });

    const finalUnitPrice = currentModalItem.price + extraPrice;

    // Create unique cart identifier based on product ID + Date to allow multiple equal products with different addons
    const cartItemId = currentModalItem.id + '_' + Date.now();

    const cartItem = {
        id: cartItemId,
        productId: currentModalItem.id,
        name: currentModalItem.name,
        price: finalUnitPrice,
        qty: currentModalQty,
        obs: obs,
        addons: selectedAddons
    };

    clientCart.push(cartItem);

    updateCartUI();
    closeItemModal();
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
    const totalQty = clientCart.reduce((sum, c) => sum + c.qty, 0);
    const totalValue = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);

    // Update Head/Header Badge
    const headerBadge = document.getElementById('cart-badge-header');
    if (headerBadge) {
        headerBadge.textContent = totalQty;
        headerBadge.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    // Update Bottom Bar
    const bottomBadge = document.getElementById('cart-badge-bottom');
    if (bottomBadge) {
        bottomBadge.textContent = totalQty;
    }

    const totalElBar = document.getElementById('cart-bar-total');
    if (totalElBar) {
        totalElBar.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
    }

    const container = document.getElementById('bottom-cart-container');
    if (container) {
        if (totalQty > 0) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            container.classList.remove('expanded');
        }
    }

    renderCartItems();
}

function toggleBottomCart() {
    const container = document.getElementById('bottom-cart-container');
    if (!container) return;

    if (clientCart.length === 0) return;

    container.classList.toggle('expanded');

    if (container.classList.contains('expanded')) {
        document.body.style.overflow = 'hidden';
    } else {
        document.body.style.overflow = '';
    }
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
        <div class="cart-item" style="flex-direction: column; align-items: flex-start; gap: 8px;">
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
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
            ${item.addons && item.addons.length > 0 ? `<div style="font-size:0.8rem; color:var(--color-text-muted);">+ ${item.addons.map(a => a.name).join(', ')}</div>` : ''}
            ${item.obs ? `<div style="font-size:0.8rem; color:var(--warning-color);">* Obs: ${item.obs}</div>` : ''}
        </div>
    `).join('');

    // Update total
    const totalValue = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    const totalEl = document.getElementById('client-cart-total');
    if (totalEl) totalEl.textContent = `R$ ${totalValue.toFixed(2).replace('.', ',')}`;
}

function openCart() {
    toggleBottomCart();
}

function closeCart() {
    const container = document.getElementById('bottom-cart-container');
    if (container) container.classList.remove('expanded');
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

    // Clear inputs first
    const inputs = ['nome-input', 'whatsapp-input', 'endereco-input', 'mesa-input', 'troco-input'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    // Load saved profile if available
    try {
        const savedProfile = localStorage.getItem('lacasa_client_profile');
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            if (profile.nome) document.getElementById('nome-input').value = profile.nome;
            if (profile.whatsapp) document.getElementById('whatsapp-input').value = profile.whatsapp;

            // Populate Dropdown for Entrega
            const addrSelect = document.getElementById('endereco-selecionado');
            if (addrSelect) {
                addrSelect.innerHTML = '<option value="">Selecione um endereço salvo...</option>';
                let hasAddresses = false;

                // Prioritize 'enderecos' array, but fallback to 'endereco' string
                const addresses = (profile.enderecos && Array.isArray(profile.enderecos)) ? profile.enderecos : (profile.endereco ? [profile.endereco] : []);

                if (addresses.length > 0) {
                    addresses.forEach((addr, idx) => {
                        if (!addr) return;
                        hasAddresses = true;
                        const opt = document.createElement('option');
                        opt.value = addr;
                        opt.textContent = addr.substring(0, 40) + (addr.length > 40 ? '...' : '');
                        addrSelect.appendChild(opt);
                    });
                }

                addrSelect.style.display = hasAddresses ? 'block' : 'none';
            }
        }
    } catch (e) {
        console.warn('Erro ao carregar perfil salvo no checkout:', e);
    }

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

    // UI Updates based on Tipo
    const addressSection = document.getElementById('endereco-section');
    const mesaSection = document.getElementById('mesa-section');
    const storeAddressSection = document.getElementById('store-address-display');
    const whatsappSection = document.getElementById('whatsapp-section');
    const taxaLine = document.getElementById('taxa-line');

    // Reset visibility
    if (addressSection) addressSection.style.display = 'none';
    if (mesaSection) mesaSection.style.display = 'none';
    if (storeAddressSection) storeAddressSection.style.display = 'none';
    if (whatsappSection) whatsappSection.style.display = 'block'; // Default to visible
    if (taxaLine) taxaLine.style.display = 'none';

    if (tipo === 'entrega') {
        if (addressSection) addressSection.style.display = 'block';
        if (taxaLine) {
            taxaLine.style.display = 'flex';
            document.getElementById('checkout-taxa').textContent = 'A combinar';
        }
    } else if (tipo === 'local') {
        if (mesaSection) mesaSection.style.display = 'block';
        if (whatsappSection) whatsappSection.style.display = 'none'; // Not needed for local
    } else if (tipo === 'retirada') {
        if (storeAddressSection) {
            storeAddressSection.style.display = 'block';
            // Fetch store address
            if (typeof FireDB !== 'undefined') {
                FireDB.loadSettings().then(settings => {
                    const addrInfo = document.getElementById('store-address-info');
                    if (addrInfo) {
                        addrInfo.innerHTML = settings?.storeAddress
                            ? `<strong>Nosso Endereço:</strong><br>${settings.storeAddress}`
                            : '<em>Endereço da loja indisponível no momento.</em>';
                    }
                }).catch(() => { });
            }
        }
    }
}

function selectPay(pay) {
    selectedPay = pay;
    document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.pay-btn[data-pay="${pay}"]`).classList.add('active');

    document.getElementById('troco-section').style.display = pay === 'Dinheiro' ? 'block' : 'none';
}

async function submitOrder() {
    const nome = document.getElementById('nome-input')?.value.trim();
    const whatsapp = document.getElementById('whatsapp-input')?.value.trim();
    const isEntrega = selectedTipo === 'entrega';
    const isLocal = selectedTipo === 'local';

    if (!nome) {
        alert('Por favor, preencha seu nome.');
        document.getElementById('nome-input').focus();
        return;
    }

    if (!isLocal && !whatsapp) {
        alert('Por favor, preencha seu WhatsApp.');
        document.getElementById('whatsapp-input').focus();
        return;
    }

    let enderecoFinal = null;
    if (isEntrega) {
        const enderecoValue = document.getElementById('endereco-input')?.value;
        const enderecoSelect = document.getElementById('endereco-selecionado');
        const enderecoSelecionado = enderecoSelect && enderecoSelect.style.display !== 'none' ? enderecoSelect.value : '';

        enderecoFinal = enderecoValue || enderecoSelecionado;

        if (!enderecoFinal || enderecoFinal.trim() === '') {
            alert('Por favor, selecione ou digite um endereço de entrega válido.');
            return;
        }
        enderecoFinal = enderecoFinal.trim();
    }

    const subtotal = clientCart.reduce((sum, c) => sum + (c.price * c.qty), 0);
    let pixPayloadUrl = null;

    if (selectedPay === 'Pix') {
        try {
            const settings = await FireDB.loadSettings();
            const pixKey = settings?.pixKey || 'suachavepix@email.com'; // Fallback for testing
            const merchantName = settings?.pixMerchantName || 'La Casa de Pastel';
            const merchantCity = settings?.pixMerchantCity || 'SAO PAULO';
            const txid = `PEDIDO`;

            pixPayloadUrl = generatePixBrCode(pixKey, subtotal, merchantName, merchantCity, txid);
            console.log("PIX PAYLOAD GENERATED:", pixPayloadUrl);
        } catch (e) {
            console.warn("Could not generate Pix payload:", e);
        }
    }

    // Generate a random password if 'local'
    let generatedSenha = null;
    if (isLocal) {
        // Generate a 4 digit code
        generatedSenha = Math.floor(1000 + Math.random() * 9000).toString();
    }

    const order = {
        items: clientCart.map(c => ({
            id: c.id,
            productId: c.productId,
            name: c.name,
            price: c.price,
            qty: c.qty,
            obs: c.obs || null,
            addons: c.addons || []
        })),
        total: subtotal,
        tipo: selectedTipo,
        pagamento: selectedPay,
        contato: isLocal ? nome : `${nome} - ${whatsapp}`,
        nome: nome,
        whatsapp: isLocal ? null : whatsapp,
        endereco: isEntrega ? enderecoFinal : null,
        mesa: isLocal ? document.getElementById('mesa-input')?.value.trim() || null : null,
        senhaGerada: generatedSenha, // This will be handled differently in PDV later, but good to store
        trocoParaValor: selectedPay === 'Dinheiro' ? parseFloat(document.getElementById('troco-input')?.value) || null : null,
        status: 'pendente',
        fcmToken: null,
        isOnline: true,
        pixPayload: pixPayloadUrl,
        obsPedido: document.getElementById('obs-pedido-input')?.value.trim() || null
    };

    // Tenta obter o token de notificação para atrelar ao pedido
    try {
        if (typeof FireDB.requestNotificationPermission === 'function') {
            const token = await FireDB.requestNotificationPermission();
            if (token) {
                order.fcmToken = token;
                console.log("Token FCM atrelado ao pedido.");
            }
        }
    } catch (e) {
        console.warn("Erro ao obter token FCM durante o checkout:", e);
    }

    // Save profile for future orders
    try {
        const profile = {
            nome: order.nome,
            whatsapp: order.whatsapp,
            endereco: order.endereco || ''
        };
        localStorage.setItem('lacasa_client_profile', JSON.stringify(profile));
    } catch (e) {
        console.warn('Erro ao salvar perfil:', e);
    }

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

        if (selectedPay === 'Pix') {
            // Refined flow: Show Pix modal first
            openPixModal(orderId, pixPayloadUrl);
        } else {
            showTracking(orderId);
        }

        // Adiciona à lista de notificações/histórico
        addNotification(`Pedido #${orderId.slice(-4).toUpperCase()} Enviado`, `Seu pedido foi recebido e está aguardando aprovação.`);

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
// --- PIX MODAL (REFINED FLOW) ---
// ============================================================

let currentPixOrderId = null;

function openPixModal(orderId, payload) {
    currentPixOrderId = orderId;
    const modal = document.getElementById('pix-modal');
    const payloadEl = document.getElementById('pix-modal-payload');

    if (payloadEl) payloadEl.textContent = payload || 'Erro ao gerar código.';
    if (modal) modal.style.display = 'flex';

    startPixTimer(orderId, true);
    document.body.style.overflow = 'hidden';

    // Inicia listener para fechar auto se aprovado
    const unsub = FireDB.onOrderStatus(orderId, (data) => {
        if (data.status === 'aprovado' || data.status === 'preparando') {
            unsub();
            closePixModal();
            showTracking(orderId);
            notifyClient("Pagamento Aprovado!", "Seu pedido já está sendo preparado.");
        }
    });
}

function closePixModal() {
    const modal = document.getElementById('pix-modal');
    if (modal) modal.style.display = 'none';
    if (pixTimerInterval) clearInterval(pixTimerInterval);
    document.body.style.overflow = '';

    // Se fechar manual, vai pro tracking padrão
    if (currentPixOrderId) {
        showTracking(currentPixOrderId);
        currentPixOrderId = null;
    }
}

function copyPixCode() {
    const payload = document.getElementById('pix-modal-payload').textContent;
    if (!payload || payload.includes('Erro')) return;

    navigator.clipboard.writeText(payload).then(() => {
        const btn = document.querySelector('.btn-copy-pix');
        const originalContent = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> COPIADO!';
        btn.style.background = 'var(--color-success)';
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.style.background = '#32bcad';
        }, 2000);
    });
}

let pixTimerInterval = null;

function startPixTimer(orderId, isModal = false) {
    let timeLeft = 120; // 2 minutos
    const timerDisplayId = isModal ? 'pix-modal-timer' : 'pix-timer-' + orderId;

    if (pixTimerInterval) clearInterval(pixTimerInterval);

    pixTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft < 0) {
            clearInterval(pixTimerInterval);
            return;
        }
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        const display = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        const el = document.getElementById(timerDisplayId);
        if (el) el.textContent = display;
    }, 1000);
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
        renderTrackingSteps(data);
    });

    // Pede permissão para notificações de navegador
    requestNotificationPermission();
}

function renderTrackingSteps(orderData) {
    const currentStatus = orderData.status;
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

    // --- Notificações em Tempo Real (Browser) ---
    const lastStatus = container.getAttribute('data-last-status');
    const lastMsg = container.getAttribute('data-last-msg');
    if (lastStatus && lastStatus !== currentStatus && currentStatus !== 'pendente') {
        notifyClient("Atualização do Pedido", `Seu pedido passou para: ${labels[currentStatus]?.text || currentStatus}`);
    }
    if (orderData.lastMessage && lastMsg !== orderData.lastMessage) {
        notifyClient("Nova Mensagem da Loja", orderData.lastMessage);
    }
    container.setAttribute('data-last-status', currentStatus);
    container.setAttribute('data-last-msg', orderData.lastMessage || '');

    let html = `
        <!-- Mensagem Direta (Destaque) -->
        ${orderData.lastMessage ? `
            <div style="background:rgba(229,9,20,0.1); border:1px solid var(--color-primary); padding:12px; border-radius:8px; margin-bottom:20px; animation: slideIn 0.3s ease-out; text-align:left;">
                <p style="font-size:0.7rem; color:var(--color-primary); margin-bottom:4px; font-weight:bold; text-transform:uppercase;">Mensagem da Loja:</p>
                <p style="font-size:0.95rem; color:white; font-weight:500;">${orderData.lastMessage}</p>
            </div>
        ` : ''}
    `;

    html += steps.map((step, idx) => {
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

    // Se houver Payload Pix, renderiza bloco para Copiar com Timer
    if (orderData.pixPayload) {
        const isApproved = orderData.status === 'aprovado' || orderData.status === 'preparando' || orderData.status === 'pronto';

        html += `
            <div style="margin-top: 20px; padding: 15px; background: rgba(50, 188, 173, 0.1); border: 1px solid #32bcad; border-radius: 8px; text-align: center;">
                ${isApproved ? `
                    <p style="color: #32bcad; font-weight: bold; font-size: 1.1rem;">
                        <i class="fa-solid fa-check-circle"></i> PAGAMENTO APROVADO
                    </p>
                    <p style="font-size: 0.85rem; margin-top: 5px;">Seu pedido já está em processamento!</p>
                ` : `
                    <p style="font-size: 0.9rem; font-weight: bold; color: #32bcad; margin-bottom: 8px;">
                        <i class="fa-brands fa-pix"></i> PIX COPIA E COLA
                    </p>
                    <div id="pix-timer-${orderData.id}" style="font-size: 1.2rem; font-weight: 800; color: var(--color-primary); margin-bottom: 10px;">2:00</div>
                    <p style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 10px;">
                        Toque no código abaixo para copiar e pague no app do seu banco.
                    </p>
                    <div onclick="navigator.clipboard.writeText('${orderData.pixPayload}').then(()=>alert('Pix copiado!'))" 
                         style="font-size: 0.75rem; word-break: break-all; padding: 10px; background: var(--bg-dark); border: 1px solid var(--border-color); border-radius: 5px; cursor: pointer; color: white;">
                        ${orderData.pixPayload}
                    </div>
                `}
            </div>
        `;

        // Auto-atribui o timer se ainda não estiver aprovado
        if (!isApproved && !pixTimerInterval) {
            setTimeout(() => startPixTimer(orderData.id), 100);
        }
    }

    container.innerHTML = html;
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
        // Garante visibilidade global explícita
        window.FireDB = FireDB;
        window.db = db;

        await checkStoreStatus();
        await loadMenu();

        // Inicia listener de mudanças nos produtos para manter cardápio atualizado
        if (typeof FireDB !== 'undefined' && db) {
            FireDB.onProductsChange((updatedProds) => {
                console.log('🔄 Cardápio atualizado via Firebase');
                menuProducts = updatedProds.filter(p => p.active !== false && p.stock > 0);
                renderCategoryTabs();
                renderMenu(getCurrentCategory());
            });
        }
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

    // Check Notification Permission
    setTimeout(checkNotificationPermission, 2500);

    // Carrega notificações salvas
    loadNotifications();
    updateNotifBadge();
});

// ============================================================
// --- PERFIL DO CLIENTE & ENDEREÇOS ---
// ============================================================
// --- NAVEGAÇÃO SPA (VIEWS) ---
// ============================================================

function switchView(viewName) {
    // Se clicar no que já está aberto e não for o menu, volta pro menu (toggle)
    const currentActive = document.querySelector('.view.active');
    if (currentActive && currentActive.id === `view-${viewName}` && viewName !== 'menu') {
        switchView('menu');
        return;
    }

    // Esconde todas as views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Mostra a view desejada
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.classList.add('active');

    // Atualiza Bottom Nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navItem = document.getElementById(`nav-${viewName}`);
    if (navItem) navItem.classList.add('active');

    // Se for perfil, carrega os dados
    if (viewName === 'profile') {
        loadProfileToView();
    }

    // Se for notificações, renderiza e limpa badge
    if (viewName === 'notifications') {
        renderNotifications();
    }
}

// ============================================================
// --- PERFIL DO CLIENTE & ENDEREÇOS (SPA) ---
// ============================================================

let currentAddresses = [];

function loadProfileToView() {
    try {
        const savedProfile = localStorage.getItem('lacasa_client_profile');
        if (savedProfile) {
            const profile = JSON.parse(savedProfile);
            const nomeEl = document.getElementById('profile-nome');
            const whatsappEl = document.getElementById('profile-whatsapp');

            if (nomeEl && profile.nome) nomeEl.value = profile.nome;
            if (whatsappEl && profile.whatsapp) whatsappEl.value = profile.whatsapp;

            if (profile.enderecos && Array.isArray(profile.enderecos)) {
                currentAddresses = [...profile.enderecos];
            } else if (profile.endereco) {
                currentAddresses = [profile.endereco];
            } else {
                currentAddresses = [];
            }
        }
    } catch (e) { console.warn("Erro ao carregar perfil para View", e); }
    renderProfileAddresses();
}

function renderProfileAddresses() {
    const container = document.getElementById('profile-addresses-container');
    if (!container) return;

    if (currentAddresses.length === 0) {
        container.innerHTML = '<p style="font-size:0.85rem; color:var(--color-text-muted); text-align:center; padding:10px;">Nenhum endereço salvo.</p>';
        return;
    }

    container.innerHTML = currentAddresses.map((addr, idx) => `
        <div class="address-hub-item">
            <input type="text" class="checkout-input addr-input-field" value="${addr}" placeholder="Rua, número, bairro..." style="flex:1;">
            <button type="button" class="btn-remove-addr" onclick="removeAddressField(${idx})">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `).join('');
}

function addNewAddressField() {
    currentAddresses.push('');
    renderProfileAddresses();
}

function removeAddressField(idx) {
    currentAddresses.splice(idx, 1);
    renderProfileAddresses();
}

function saveProfileSetup() {
    const nomeEl = document.getElementById('profile-nome');
    const whatsappEl = document.getElementById('profile-whatsapp');

    const nome = nomeEl ? nomeEl.value.trim() : '';
    const whatsapp = whatsappEl ? whatsappEl.value.trim() : '';

    // Coletar endereços dos inputs reais
    const addrInputs = document.querySelectorAll('.addr-input-field');
    const updatedAddresses = [];
    addrInputs.forEach(input => {
        const val = input.value.trim();
        if (val) updatedAddresses.push(val);
    });

    if (!nome && !whatsapp && updatedAddresses.length === 0) {
        alert('Preencha ao menos um campo para salvar.');
        return;
    }

    const profile = {
        nome,
        whatsapp,
        enderecos: updatedAddresses
    };

    localStorage.setItem('lacasa_client_profile', JSON.stringify(profile));
    currentAddresses = updatedAddresses;

    alert('Perfil atualizado com sucesso!');
    switchView('menu'); // Volta pro cardápio após salvar
}

// Helper para pegar location e transformar em string aproximada, serve pro modal de Checkout E View de Perfil
function getLocationAndFill(forCheckout = true) {
    if (!navigator.geolocation) {
        alert("Geolocalização não é suportada.");
        return;
    }

    const statusEl = document.getElementById(forCheckout ? 'geo-status-checkout' : 'geo-status-profile');
    if (statusEl) {
        statusEl.style.display = 'block';
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`);
                const data = await response.json();

                let addrStr = '';
                if (data && data.address) {
                    const road = data.address.road || '';
                    const suburb = data.address.suburb || data.address.neighbourhood || '';
                    const city = data.address.city || data.address.town || '';
                    addrStr = `${road}, S/N, ${suburb}, ${city}`;
                } else {
                    addrStr = `GPS: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
                }

                if (forCheckout) {
                    const el = document.getElementById('endereco-input');
                    if (el) el.value = addrStr;
                } else {
                    currentAddresses.push(addrStr);
                    renderProfileAddresses();
                }

                if (statusEl) statusEl.style.display = 'none';
            } catch (error) {
                console.error("Erro GPS:", error);
                if (statusEl) statusEl.style.display = 'none';
                const fallback = `Lat: ${lat.toFixed(5)}, Lon: ${lon.toFixed(5)}`;
                if (forCheckout) {
                    document.getElementById('endereco-input').value = fallback;
                } else {
                    currentAddresses.push(fallback);
                    renderProfileAddresses();
                }
            }
        },
        () => {
            if (statusEl) statusEl.style.display = 'none';
            alert("Não conseguimos acessar sua localização.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

// ============================================================
// --- NOTIFICAÇÕES (FCM) ---
// ============================================================

function checkNotificationPermission() {
    // Só mostra se for suportado e não tiver sido negado permanentemente
    if (!('Notification' in window)) return;

    const banner = document.getElementById('notification-banner');
    const dismissed = localStorage.getItem('lacasa_fcm_dismissed');

    if (Notification.permission === 'default' && !dismissed) {
        // Primeira vez ou ainda não decidiu
        if (banner) banner.style.display = 'block';
    } else if (Notification.permission === 'granted') {
        // Já tem permissão, tenta pegar o token preventivamente
        if (typeof FireDB !== 'undefined' && typeof FireDB.requestNotificationPermission === 'function') {
            FireDB.requestNotificationPermission().then(token => {
                if (token) console.log("Token FCM já garantido na inicialização.");
            }).catch(e => console.log("FCM silenciado", e));
        }
    }
}

function dismissNotificationBanner() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.style.display = 'none';
    localStorage.setItem('lacasa_fcm_dismissed', 'true');
}

async function requestNotificationPermission() {
    const banner = document.getElementById('notification-banner');
    if (banner) banner.style.display = 'none';

    try {
        if (typeof FireDB !== 'undefined' && typeof FireDB.requestNotificationPermission === 'function') {
            const token = await FireDB.requestNotificationPermission();
            if (token) {
                alert("Notificações ativadas com sucesso! Você receberá atualizações sobre seus pedidos.");
            } else {
                alert("Não foi possível ativar as notificações (permissão não concedida).");
            }
        }
    } catch (e) {
        console.warn("Erro ao pedir notificação", e);
        alert("Erro ao pedir ativação de notificações. Verifique as configurações do seu navegador.");
    }
}
// ============================================================
// --- CENTRAL DE NOTIFICAÇÕES ---
// ============================================================

let notifications = [];

function addNotification(title, body) {
    const notif = {
        id: Date.now(),
        title,
        body,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        read: false
    };
    notifications.unshift(notif);
    saveNotifications();
    renderNotifications();
    updateNotifBadge();
}

function saveNotifications() {
    localStorage.setItem('lacasa_notifications', JSON.stringify(notifications.slice(0, 20)));
}

function loadNotifications() {
    const stored = localStorage.getItem('lacasa_notifications');
    if (stored) notifications = JSON.parse(stored);
}

function renderNotifications() {
    const container = document.getElementById('notifications-list');
    if (!container) return;

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-bell-slash"></i>
                <p>Nenhuma notificação por enquanto.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notifications.map(n => `
        <div class="notification-item ${n.read ? '' : 'unread'}">
            <span class="notif-time">${n.time}</span>
            <span class="notif-title">${n.title}</span>
            <p class="notif-body">${n.body}</p>
        </div>
    `).join('');

    // Mark as read when viewing
    if (document.getElementById('view-notifications').classList.contains('active')) {
        setTimeout(() => {
            notifications.forEach(n => n.read = true);
            saveNotifications();
            updateNotifBadge();
            renderNotifications();
        }, 2000);
    }
}

function updateNotifBadge() {
    const badge = document.getElementById('notif-badge');
    const unread = notifications.filter(n => !n.read).length;
    if (badge) {
        badge.style.display = unread > 0 ? 'block' : 'none';
    }
}

// ============================================================
// --- PIX BR CODE (EMV QR Code — Padrão Banco Central) ---
// ============================================================

/**
 * Calcula CRC16-CCITT (0xFFFF) — obrigatório no payload BR Code
 */
function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= (str.charCodeAt(i) << 8);
        for (let j = 0; j < 8; j++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Monta um campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor
 */
function emvField(id, value) {
    const len = String(value.length).padStart(2, '0');
    return `${id}${len}${value}`;
}

/**
 * Gera o payload completo do Pix BR Code com valor dinâmico.
 */
function generatePixBrCode(pixKey, amount, name, city, txid, desc = '') {
    // Sanitiza strings
    const safeName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 25).trim();
    const safeCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().substring(0, 15).trim();
    const safeTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

    // Formata valor com 2 casas decimais obrigatoriamente
    const safeAmount = parseFloat(amount).toFixed(2);

    // ID 26: Informações da conta remetente (Merchant Account Information)
    // GUI padrao Banco Central + Chave + Descrição(Opcional)
    const gui = emvField('00', 'br.gov.bcb.pix');
    const key = emvField('01', pixKey);
    const description = desc ? emvField('02', desc.substring(0, 40)) : '';
    const accountInfo = emvField('26', gui + key + description);

    // Constrói payload inicial
    const payload = [
        emvField('00', '01'),                       // 00: Payload Format Indicator (01)
        emvField('01', '11'),                       // 01: Point of Initiation Method (11 = Estático, permite reuso)
        accountInfo,                                // 26: Merchant Account Information
        emvField('52', '0000'),                     // 52: Merchant Category Code (0000 = Não informado)
        emvField('53', '156'),                      // 53: Transaction Currency (156 = BRL)
        emvField('54', safeAmount),                 // 54: Transaction Amount
        emvField('58', 'BR'),                       // 58: Country Code (BR)
        emvField('59', safeName),                   // 59: Merchant Name
        emvField('60', safeCity),                   // 60: Merchant City
        emvField('62', emvField('05', safeTxid))    // 62: Additional Data Field (TxId)
    ].join('');

    // Adiciona o field 63 (CRC) - O valor deve ser incluído no cálculo
    const payloadForCrc = payload + '6304';
    const crc = crc16(payloadForCrc);

    return payloadForCrc + crc;
}

function notifyClient(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, {
                body,
                icon: '/cliente/icon-192.png',
                badge: '/cliente/icon-192.png'
            });
        } catch (e) { console.warn("Erro ao disparar notificação:", e); }
    }
    if (navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200]); } catch (e) { }
    }
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}
