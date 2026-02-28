// --- Estado da Aplicação ---
let products = [];
let cart = [];
let currentOrderNumber = 1;
let orderTotalCost = 0;
let isOrderFinalized = false;
let finalizedOrderData = null;
let currentPaymentMethod = 'Dinheiro';
let salesHistory = [];
let shiftSales = {
    count: 0,
    total: 0
};

// --- PIX Checkout State ---
let pixPendingSale = null; // Guarda dados da venda pendente de confirmação Pix

// --- Modal Genérico de Confirmação ---
let _confirmCallback = null;

function showConfirm({ icon = '⚠️', title = 'Confirmar', msg = '', btnText = 'Confirmar', btnColor = 'var(--danger-color)', onConfirm }) {
    document.getElementById('modal-confirm-icon').textContent = icon;
    document.getElementById('modal-confirm-title').textContent = title;
    document.getElementById('modal-confirm-msg').textContent = msg;
    const okBtn = document.getElementById('modal-confirm-ok-btn');
    okBtn.textContent = btnText;
    okBtn.style.background = btnColor;
    _confirmCallback = onConfirm;
    document.getElementById('modal-confirm').style.display = 'flex';
}

function modalConfirmOk() {
    document.getElementById('modal-confirm').style.display = 'none';
    if (_confirmCallback) _confirmCallback();
    _confirmCallback = null;
}

function modalConfirmCancel() {
    document.getElementById('modal-confirm').style.display = 'none';
    _confirmCallback = null;
}

// --- Fila de Impressão de Múltiplos Cupons ---
let printQueue = [];

window.addEventListener('afterprint', () => {
    if (printQueue.length > 0) {
        setTimeout(processPrintQueue, 500); // Dá um fôlego para o SO antes da próxima janela
    } else if (typeof isOrderFinalized !== 'undefined' && isOrderFinalized) {
        // Se a fila de impressão terminou e tínhamos finalizado um pedido, inicia um novo pedido
        startNewOrder();
    }
});

function processPrintQueue() {
    if (printQueue.length === 0) return;
    const htmlInfo = printQueue.shift();
    const area = document.getElementById('print-area');
    area.innerHTML = htmlInfo;

    // Espera imagens marcadas com data-preload antes de imprimir
    const imgs = Array.from(area.querySelectorAll('img[data-preload]'));
    if (imgs.length === 0) { window.print(); return; }

    let loaded = 0;
    const proceed = () => { loaded++; if (loaded >= imgs.length) window.print(); };
    imgs.forEach(img => {
        if (img.complete && img.naturalWidth > 0) { proceed(); }
        else { img.onload = proceed; img.onerror = proceed; }
    });
}

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', async () => {
    // Carrega dados (Firebase ou localStorage)
    await loadData();

    // Renderiza interface
    renderProducts();
    renderInventory();
    updateCartUI();
    updateClosureUI();
    selectPayment('Dinheiro');

    // Renderiza grid de horários e modo da loja
    renderStoreHoursGrid();
    loadStoreMode();

    // Carrega auto-approve
    loadAutoApprove();

    // Inicia listener de pedidos online (se Firebase configurado)
    try {
        if (typeof FireDB !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY_AQUI') {
            // Garante visibilidade global explícita
            window.FireDB = FireDB;
            window.db = db;

            startOrdersListener();

            FireDB.onSettingsChange((settings) => {
                if (settings?.autoApprove !== undefined) {
                    const toggle = document.getElementById('auto-approve-toggle');
                    if (toggle) toggle.checked = settings.autoApprove;
                }
                // Sync store address if remote exists
                if (settings?.storeAddress) {
                    localStorage.setItem('lacasa_store_address', settings.storeAddress);
                    const addressEl = document.getElementById('store-address-input');
                    if (addressEl && !addressEl.value) {
                        addressEl.value = settings.storeAddress;
                    }
                }
                // Atualiza modo da loja se mudou remotamente
                if (settings?.storeMode) {
                    setStoreManual(settings.storeMode);
                }
            });
        }
    } catch (e) {
        console.log('Firebase não configurado, trabalhando apenas offline.');
    }

    // Monitora conexão em tempo real
    initConnectionMonitor();

    // Diagnóstico Firebase
    runFirebaseDiagnostic();

    // Detecta se está rodando no Electron para mostrar o painel de atualização
    if (typeof process !== 'undefined' && process.versions && process.versions.electron) {
        document.getElementById('update-panel').style.display = 'block';
    }
});

// Navegação de Abas
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(`tab-${tabId}`).classList.add('active');
    event.currentTarget.classList.add('active');

    if (tabId === 'estoque') renderInventory();
    if (tabId === 'caixa') renderProducts();
}

// --- Persistência de Dados (Local Storage via JSON) ---
async function initProducts() {
    // 1. Carrega do localStorage primeiro para carregamento instantâneo offline (Offline-First)
    const stored = localStorage.getItem('lacasa_products');
    if (stored) {
        products = JSON.parse(stored);
    } else {
        products = [];
    }

    // 2. Inicia listener em tempo real do Firebase no background
    if (typeof FireDB !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY_AQUI') {
        try {
            FireDB.onProductsChange((cloudProducts) => {
                if (cloudProducts && cloudProducts.length > 0) {
                    products = cloudProducts;
                    localStorage.setItem('lacasa_products', JSON.stringify(products));

                    // Atualiza a view se a aba respectiva estiver aberta
                    if (document.getElementById('tab-caixa').classList.contains('active')) {
                        const filterText = document.getElementById('search-product')?.value || '';
                        renderProducts(filterText);
                    }
                    if (document.getElementById('tab-estoque').classList.contains('active')) {
                        const searchInv = document.getElementById('search-inventory')?.value || '';
                        renderInventory(searchInv);
                    }
                    updateCartUI(); // Atualiza carrinho caso nomes ou preços mudem
                }
            });
        } catch (e) {
            console.warn('⚠️ Firebase não configurado ou offline para listen de produtos: ', e);
        }
    }
}

async function loadData() {
    await initProducts();

    // Carregar Estado do Turno
    const savedShift = localStorage.getItem('lacasa_shift');
    if (savedShift) {
        shiftSales = JSON.parse(savedShift);
    }

    // Carregar Senha Atual
    const savedOrderNum = localStorage.getItem('lacasa_order_num');
    if (savedOrderNum) {
        currentOrderNumber = parseInt(savedOrderNum);
    }
    document.getElementById('current-order-number').innerText = `Senha: #${String(currentOrderNumber).padStart(3, '0')}`;

    const savedPix = localStorage.getItem('lacasa_pix_key');
    if (savedPix) {
        document.getElementById('pix-key-input').value = savedPix;
        generatePixQR(savedPix);
    }

    const savedMerchantName = localStorage.getItem('lacasa_merchant_name');
    if (savedMerchantName) document.getElementById('pix-merchant-name').value = savedMerchantName;

    const savedMerchantCity = localStorage.getItem('lacasa_merchant_city');
    if (savedMerchantCity) document.getElementById('pix-merchant-city').value = savedMerchantCity;

    const savedStoreAddress = localStorage.getItem('lacasa_store_address');
    if (savedStoreAddress) document.getElementById('store-address-input').value = savedStoreAddress;

    loadReceiptConfig();

    // Carregar Histórico
    const savedHistory = localStorage.getItem('lacasa_history');
    if (savedHistory) {
        salesHistory = JSON.parse(savedHistory);
        renderHistory();
    }

    // Atualiza a interface do fechamento na inicialização
    updateClosureUI();
}

async function saveProducts(updatedProduct = null, deletedId = null) {
    // Salva cache local para offline-first (instantâneo)
    localStorage.setItem('lacasa_products', JSON.stringify(products));

    // Envia iteração granular para Firebase se possível
    if (typeof FireDB !== 'undefined' && firebaseConfig.apiKey !== 'SUA_API_KEY_AQUI') {
        try {
            if (deletedId) {
                await FireDB.deleteProduct(deletedId);
            } else if (updatedProduct) {
                await FireDB.saveProduct(updatedProduct);
            }
            console.log('☁️ Alteração de produto enviada ao Firebase (cache/nuvem).');
        } catch (e) {
            console.warn('⚠️ Erro ao enviar produto ao Firebase (será sincronizado quando a conexão voltar):', e);
        }
    }
}

async function syncToCloud() {
    const btn = event?.currentTarget;
    const originalText = btn ? btn.innerHTML : '';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando...';
    }

    try {
        await FireDB.saveAllProducts(products);
        alert('✅ Estoque sincronizado completamente com a nuvem (Forçado)!');
    } catch (e) {
        alert('❌ Erro ao sincronizar forçadamente: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

function saveShiftData() {
    localStorage.setItem('lacasa_shift', JSON.stringify(shiftSales));
    localStorage.setItem('lacasa_order_num', currentOrderNumber.toString());
    localStorage.setItem('lacasa_history', JSON.stringify(salesHistory));
}


// --- PDV / Frente de Caixa ---

function renderProducts(filterText = '') {
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';

    // Filtrar por texto e exibir apenas produtos Ativos (active não falso)
    const filtered = products.filter(p =>
        p.active !== false &&
        p.isAddon !== true &&
        p.name.toLowerCase().includes(filterText.toLowerCase())
    );

    filtered.forEach(p => {
        const isOut = p.stock <= 0;
        const isLow = p.stock <= 5 && !isOut;

        const card = document.createElement('div');
        card.className = `product-card ${isOut ? 'stock-out' : ''}`;
        card.style.backgroundColor = 'var(--bg-panel)';
        card.onclick = () => !isOut && addToCart(p.id);

        card.innerHTML = `
            <span class="product-name">${p.name}</span>
            <span class="product-price">R$ ${p.price.toFixed(2).replace('.', ',')}</span>
            <span class="product-stock ${isLow ? 'stock-low' : ''}">${isOut ? 'ESGOTADO' : 'Estoque: ' + p.stock}</span>
        `;
        grid.appendChild(card);
    });
}

function filterProducts() {
    const text = document.getElementById('search-product').value;
    renderProducts(text);
}

// --- Carrinho ---

// ============================================================
// --- PDV ITEM MODAL ---
// ============================================================
let currentPdvModalItem = null;
let currentPdvModalQty = 1;

function addToCart(productId) {
    if (isOrderFinalized) {
        startNewOrder();
    }

    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock < 1) {
        alert("Estoque esgotado!");
        return;
    }

    currentPdvModalItem = product;
    currentPdvModalQty = 1;

    document.getElementById('pdv-item-modal-title').textContent = product.name;
    document.getElementById('pdv-item-modal-desc').textContent = product.category;
    document.getElementById('pdv-item-modal-obs').value = '';
    document.getElementById('pdv-item-modal-qty').textContent = currentPdvModalQty;

    const addonsContainer = document.getElementById('pdv-item-modal-addons');
    addonsContainer.innerHTML = '';

    const availableAddons = products.filter(p => p.isAddon === true && p.active !== false && p.stock > 0);

    if (availableAddons.length > 0) {
        let addonsHTML = '<p style="font-weight:bold; margin-bottom:5px;">Adicionais Disponíveis</p>';
        availableAddons.forEach((addon, idx) => {
            addonsHTML += `
                <label style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-dark); padding:10px; border-radius:6px; margin-bottom:6px; cursor:pointer; border: 1px solid var(--border-color);">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" class="pdv-addon-checkbox" data-id="${addon.id}" data-name="${addon.name}" data-price="${addon.price}" onchange="updatePdvItemModalPrice()" style="width:18px; height:18px; accent-color:var(--success-color);">
                        <span>${addon.name}</span>
                    </div>
                    <span style="color:var(--success-color);">+ R$ ${addon.price.toFixed(2).replace('.', ',')}</span>
                </label>
            `;
        });
        addonsContainer.innerHTML = addonsHTML;
    }

    updatePdvItemModalPrice();
    document.getElementById('pdv-item-modal').style.display = 'flex';
}

function closePdvItemModal() {
    document.getElementById('pdv-item-modal').style.display = 'none';
    currentPdvModalItem = null;
}

function changePdvItemModalQty(delta) {
    if (!currentPdvModalItem) return;

    if (delta > 0 && currentPdvModalQty + delta > currentPdvModalItem.stock) {
        alert("Estoque insuficiente!");
        return;
    }

    currentPdvModalQty += delta;
    if (currentPdvModalQty < 1) currentPdvModalQty = 1;

    document.getElementById('pdv-item-modal-qty').textContent = currentPdvModalQty;
    updatePdvItemModalPrice();
}

function updatePdvItemModalPrice() {
    if (!currentPdvModalItem) return;

    let totalUnitPrice = currentPdvModalItem.price;
    const checkboxes = document.querySelectorAll('.pdv-addon-checkbox:checked');
    checkboxes.forEach(cb => {
        totalUnitPrice += parseFloat(cb.getAttribute('data-price'));
    });

    const total = totalUnitPrice * currentPdvModalQty;
    document.getElementById('pdv-item-modal-price').textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function confirmPdvItemOptions() {
    if (!currentPdvModalItem) return;

    const obs = document.getElementById('pdv-item-modal-obs').value.trim();

    const selectedAddons = [];
    let extraPrice = 0;
    document.querySelectorAll('.pdv-addon-checkbox:checked').forEach(cb => {
        const id = cb.getAttribute('data-id');
        const name = cb.getAttribute('data-name');
        const price = parseFloat(cb.getAttribute('data-price'));
        selectedAddons.push({ id, name, price });
        extraPrice += price;
    });

    const finalUnitPrice = currentPdvModalItem.price + extraPrice;
    const cartItemId = currentPdvModalItem.id + '_' + Date.now();

    const cartItem = {
        id: cartItemId,
        productId: currentPdvModalItem.id,
        name: currentPdvModalItem.name,
        price: finalUnitPrice,
        qty: currentPdvModalQty,
        obs: obs,
        addons: selectedAddons
    };

    cart.push(cartItem);

    updateCartUI();
    closePdvItemModal();
}

function updateCartQty(cartItemId, delta) {
    const itemIndex = cart.findIndex(item => String(item.id) === String(cartItemId));
    if (itemIndex > -1) {
        const item = cart[itemIndex];
        const product = products.find(p => p.id === (item.productId || item.id));

        if (delta > 0 && product && item.qty + delta > product.stock) {
            alert("Estoque insuficiente!");
            return;
        }

        item.qty += delta;
        if (item.qty <= 0) {
            cart.splice(itemIndex, 1);
        }
    }
    updateCartUI();
}

function removeFromCart(cartItemId) {
    cart = cart.filter(item => String(item.id) !== String(cartItemId));
    updateCartUI();
}

function clearCart() {
    if (isOrderFinalized) {
        startNewOrder();
        return;
    }
    if (cart.length > 0) {
        showConfirm({
            icon: '🗑️',
            title: 'Cancelar Pedido?',
            msg: 'Deseja cancelar o pedido atual? Todos os itens serão removidos do carrinho.',
            btnText: 'Sim, Cancelar',
            onConfirm: () => {
                cart = [];
                document.getElementById('pay-amount-input').value = '';
                selectPayment('Dinheiro');
                updateCartUI();
            }
        });
    }
}

function updateCartUI() {
    if (isOrderFinalized) return;
    const container = document.getElementById('cart-items');
    container.innerHTML = '';

    if (cart.length === 0) {
        container.innerHTML = '<div class="empty-cart-msg">O carrinho está vazio</div>';
        orderTotalCost = 0;
        document.getElementById('cart-total').innerText = 'R$ 0,00';
        updateChange();
        return;
    }

    let total = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        total += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="item-info">
                <span class="item-name">${item.name} 
                    ${item.addons && item.addons.length > 0 ? `<br><small style="color:var(--text-color); opacity:0.8; font-size:0.8rem;">+ ${item.addons.map(a => a.name).join(', ')}</small>` : ''}
                    ${item.obs ? `<br><small style="color:var(--warning-color); font-size:0.8rem;">* Obs: ${item.obs}</small>` : ''}
                </span>
                <span class="item-price">${item.qty}x R$ ${item.price.toFixed(2).replace('.', ',')} = R$ ${itemTotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="item-controls" style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                <button class="qty-btn" style="background:#4b5563; color:white; width: 28px; border-radius: 4px;" title="Adicionar Observação" onclick="addObservationToCartItem('${item.id}')"><i class="fa-solid fa-comment-dots"></i></button>
                <div style="width: 4px;"></div>
                <button class="qty-btn" onclick="updateCartQty('${item.id}', -1)"><i class="fa-solid fa-minus"></i></button>
                <span style="min-width: 15px; text-align: center;">${item.qty}</span>
                <button class="qty-btn" onclick="updateCartQty('${item.id}', 1)"><i class="fa-solid fa-plus"></i></button>
                <button class="qty-btn remove" onclick="removeFromCart('${item.id}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(div);
    });

    orderTotalCost = total;
    const totalFmt = `R$ ${total.toFixed(2).replace('.', ',')}`;
    document.getElementById('cart-total').innerText = totalFmt;
    updateChange();
}

function addObservationToCartItem(productId) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;

    const obs = prompt(`Adicionar observação para ${item.name}:`, item.obs || '');
    if (obs !== null) {
        item.obs = obs.trim();
        updateCartUI();
    }
}

function selectPayment(method) {
    if (isOrderFinalized) return;

    currentPaymentMethod = method;

    document.querySelectorAll('.pay-method-btn').forEach(btn => {
        if (btn.innerText.includes(method)) btn.classList.add('selected');
        else btn.classList.remove('selected');
    });

    const valueArea = document.getElementById('payment-value-area');
    const pixHint = document.getElementById('pix-payment-hint');

    if (method === 'Dinheiro') {
        valueArea.style.display = 'block';
        if (pixHint) pixHint.style.display = 'none';
    } else if (method === 'Pix') {
        valueArea.style.display = 'none';
        document.getElementById('pay-amount-input').value = '';
        // Mostra dica Pix se chave configurada
        if (pixHint) {
            const hasKey = !!localStorage.getItem('lacasa_pix_key');
            pixHint.style.display = hasKey ? 'flex' : 'none';
        }
    } else {
        valueArea.style.display = 'none';
        document.getElementById('pay-amount-input').value = '';
        if (pixHint) pixHint.style.display = 'none';
    }

    updateChange();
}

function updateChange() {
    const elChange = document.getElementById('cart-change');

    if (currentPaymentMethod === 'Dinheiro') {
        const paid = parseFloat(document.getElementById('pay-amount-input').value) || 0;
        const change = paid - orderTotalCost;

        if (change >= 0 && cart.length > 0) {
            elChange.innerText = `R$ ${change.toFixed(2).replace('.', ',')}`;
        } else {
            elChange.innerText = `R$ 0,00`;
        }
    } else {
        elChange.innerText = `R$ 0,00`;
    }
}

function getPaymentsString() {
    return currentPaymentMethod;
}

// --- Finalização e Impressão ---

function finalizeSale() {
    if (cart.length === 0) {
        alert("O carrinho está vazio!");
        return;
    }

    if (isOrderFinalized) return;

    let change = 0;
    let pixPayload = null;

    if (currentPaymentMethod === 'Dinheiro') {
        const paid = parseFloat(document.getElementById('pay-amount-input').value) || 0;
        if (paid < orderTotalCost && orderTotalCost > 0) {
            alert("O valor pago em dinheiro é menor que o total do pedido!");
            return;
        }
        change = paid - orderTotalCost;
    }

    // Gera payload Pix para imprimir no cupom
    if (currentPaymentMethod === 'Pix') {
        const pixKey = localStorage.getItem('lacasa_pix_key');
        if (!pixKey) {
            showConfirm({
                icon: 'ℹ️',
                title: 'Chave Pix não configurada',
                msg: 'Nenhuma chave Pix configurada em Gerenciamento. Deseja registrar a venda como Pix mesmo assim (sem QR Code no cupom)?',
                btnText: 'Sim, Registrar',
                btnColor: 'var(--color-primary)',
                onConfirm: () => completeSaleFlow(0, null)
            });
            return;
        } else {
            const mercName = localStorage.getItem('lacasa_merchant_name') || 'La Casa de Pastel';
            const mercCity = localStorage.getItem('lacasa_merchant_city') || 'SAO PAULO';
            pixPayload = generatePixBrCode(pixKey, orderTotalCost, mercName, mercCity, 'LACASA' + Date.now(), 'La Casa de Pastel');
        }
    }

    const orderObs = document.getElementById('order-obs')?.value.trim() || null;

    completeSaleFlow(change, pixPayload, orderObs);
}

function completeSaleFlow(change = 0, pixPayload = null, orderObs = null) {
    // Deduzir estoque
    cart.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) {
            p.stock -= item.qty;
            saveProducts(p);
        }
    });

    shiftSales.count += 1;
    shiftSales.total += orderTotalCost;

    finalizedOrderData = {
        items: [...cart],
        total: orderTotalCost,
        senha: currentOrderNumber,
        pagamento: getPaymentsString(),
        troco: change,
        pixPayload: pixPayload,
        orderObs: orderObs
    };

    salesHistory.unshift(finalizedOrderData);

    currentOrderNumber++;
    saveShiftData();

    // Continua UI e impressão
    isOrderFinalized = true;

    // Configurar UI para pós-venda
    document.getElementById('checkout-actions').style.display = 'none';
    document.getElementById('btn-nova-venda').style.display = 'block';

    document.querySelectorAll('.pay-input, .qty-btn, .pay-method-btn').forEach(el => el.disabled = true);

    updateClosureUI();
    renderProducts();
    renderHistory();

    // Imprime sequencialmente a Comanda e o Cupom
    printSequentialReceipts(finalizedOrderData);
}

function startNewOrder() {
    cart = [];
    isOrderFinalized = false;
    finalizedOrderData = null;
    document.getElementById('pay-amount-input').value = '';
    const obsInput = document.getElementById('order-obs');
    if (obsInput) obsInput.value = '';

    document.getElementById('btn-nova-venda').style.display = 'none';
    document.getElementById('checkout-actions').style.display = 'flex';

    document.querySelectorAll('.pay-input, .qty-btn, .pay-method-btn').forEach(el => el.disabled = false);
    selectPayment('Dinheiro'); // Default

    document.getElementById('current-order-number').innerText = `Senha: #${String(currentOrderNumber).padStart(3, '0')}`;
    updateCartUI();
}

function printSequentialReceipts(orderData) {
    const comandaHTML = generateComandaHTML(orderData);
    const cupomHTML = generateCupomHTML(orderData);

    // Coloca o Cupom na fila para imprimir depois
    printQueue.push(cupomHTML);

    // Dispara a impressão da Comanda AGORA
    document.getElementById('print-area').innerHTML = comandaHTML;
    window.print();
}

function printSpecificReceiptFromHistory(type, senha) {
    const sale = salesHistory.find(s => s.senha === senha);
    if (!sale) return;

    let html = '';
    if (type === 'comanda') {
        html = generateComandaHTML(sale, true);
    } else {
        html = generateCupomHTML(sale, true);
    }

    document.getElementById('print-area').innerHTML = html;
    window.print();
}

// Templates HTML Isolados
function generateComandaHTML(orderData, isReprint = false) {
    const dateStr = new Date().toLocaleString('pt-BR');
    const senhaFmt = String(orderData.senha).padStart(3, '0');

    // Dados do Cliente (se houver)
    let clientInfoHTML = '';
    if (orderData.nome || orderData.contato || orderData.tipo) {
        const tipoText = orderData.tipo ? orderData.tipo.toUpperCase() : 'BALCÃO';
        clientInfoHTML = `
            <div style="border-bottom: 1px dashed black; margin-bottom: 10px; padding-bottom: 10px;">
                <p style="margin:2px 0; font-weight:bold; font-size:16px;">[ TIPO: ${tipoText} ]</p>
                ${orderData.nome ? `<p style="margin:2px 0;"><strong>Nome:</strong> ${orderData.nome}</p>` : ''}
                ${(orderData.whatsapp || orderData.contato) ? `<p style="margin:2px 0;"><strong>Contato:</strong> ${orderData.whatsapp || orderData.contato}</p>` : ''}
                ${orderData.endereco ? `<p style="margin:2px 0;"><strong>Endereço:</strong> ${orderData.endereco}</p>` : ''}
                ${orderData.mesa ? `<p style="margin:2px 0;"><strong>Mesa:</strong> ${orderData.mesa}</p>` : ''}
            </div>
        `;
    }

    return `
        <div class="receipt">
            <div class="receipt-header">
                <h2>Cozinha - La Casa de Pastel</h2>
                <p>${isReprint ? 'Reimpressão - ' : ''}${dateStr}</p>
                <div class="receipt-senha" style="font-size: 24px; font-weight: bold;">SENHA: ${senhaFmt}</div>
            </div>
            
            ${clientInfoHTML}

            <div class="receipt-body">
                ${orderData.items.map(item => `
                    <div class="receipt-item" style="font-size: 18px; margin-bottom: 8px; font-weight: bold;">
                        <span>[ ${item.qty}x ] ${item.name}</span>
                        ${item.addons && item.addons.length > 0 ? `<div style="font-size: 14px; font-weight: normal; margin-left: 15px; margin-top: 2px;">+ ${item.addons.map(a => a.name).join(', ')}</div>` : ''}
                        ${item.obs ? `<div style="font-size: 14px; font-weight: normal; margin-left: 15px; margin-top: 2px;">* Obs: ${item.obs}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            
            ${(orderData.orderObs || orderData.obsPedido) ? `
                <div style="border-top:1px dashed black; margin-top:10px; padding-top:10px;">
                    <p style="margin:0; font-weight:bold; font-size:16px;">OBSERVAÇÃO DO PEDIDO:</p>
                    <p style="margin:2px 0; font-size:15px;">${orderData.orderObs || orderData.obsPedido}</p>
                </div>
            ` : ''}
            <div style="text-align:center; border-top: 1px dashed black; margin-top:20px; padding-top:20px;">
                *** CORTE / ENTREGAR NA COZINHA ***
            </div>
        </div>
    `;
}

function generateCupomHTML(orderData, isReprint = false) {
    const dateStr = new Date().toLocaleString('pt-BR');
    const senhaFmt = String(orderData.senha).padStart(3, '0');
    const valTroco = orderData.troco || 0;
    const pgto = orderData.pagamento || 'Dinheiro';

    // --- Configuração do Cabeçalho ---
    const logoType = localStorage.getItem('lacasa_receipt_logo_type') || 'text';
    const logoImage = localStorage.getItem('lacasa_receipt_logo_image');
    const footerMsg = localStorage.getItem('lacasa_receipt_footer_msg') || 'Obrigado pela preferência e volte sempre!';
    const receiptName = localStorage.getItem('lacasa_receipt_name') || 'LA CASA DE PASTEL';

    let headerHTML = '';
    if (logoType === 'image' && logoImage) {
        headerHTML = `<img src="${logoImage}" style="max-width:180px; max-height:70px; object-fit:contain; margin-bottom:6px;" alt="Logo">`;
    } else {
        headerHTML = `<h2 style="font-size:20px;">${receiptName}</h2>`;
    }

    // --- QR Code Pix ou Copia e Cola (se houver payload) ---
    let pixQrHTML = '';
    if (orderData.pixPayload) {
        if (orderData.isOnline) {
            // Pedidos online mostram copia e cola porque n dá pra escanear a própria tela (impressão p/ motoboy)
            pixQrHTML = `
                <div style="text-align:center; border-top:1px dashed black; margin-top:15px; padding-top:15px;">
                    <p style="font-size:11px; font-weight:bold; margin-bottom:6px; letter-spacing:1px;">PIX COPIA E COLA</p>
                    <div style="font-size:9px; word-break:break-all; padding:8px; border:1px solid #ccc; background:#f9f9f9;">
                        ${orderData.pixPayload}
                    </div>
                </div>`;
        } else {
            // Pedidos locais na loja mostram QR Code para o cliente escanear do balcão
            const qrUrl = pixPayloadToQrUrl(orderData.pixPayload, 200);
            pixQrHTML = `
                 <div style="text-align:center; border-top:1px dashed black; margin-top:15px; padding-top:15px;">
                     <p style="font-size:11px; font-weight:bold; margin-bottom:6px; letter-spacing:1px;">PAGUE VIA PIX</p>
                     <img src="${qrUrl}" alt="QR Code Pix" data-preload
                         style="width:160px; height:160px; display:block; margin:0 auto;">
                     <p style="font-size:8px; margin-top:4px; color:#555;">Escaneie com o app do seu banco</p>
                 </div>`;
        }
    }

    // Dados do Cliente (se houver)
    let clientInfoHTML = '';
    if (orderData.nome || orderData.contato || orderData.tipo) {
        const tipoText = orderData.tipo ? orderData.tipo.toUpperCase() : 'BALCÃO';
        clientInfoHTML = `
            <div style="border-bottom: 1px dashed black; margin-bottom: 10px; padding-bottom: 10px;">
                <p style="margin:2px 0; font-weight:bold; font-size:14px;">[ TIPO: ${tipoText} ]</p>
                ${orderData.nome ? `<p style="margin:2px 0; font-size:12px;"><strong>Nome:</strong> ${orderData.nome}</p>` : ''}
                ${(orderData.whatsapp || orderData.contato) ? `<p style="margin:2px 0; font-size:12px;"><strong>Contato:</strong> ${orderData.whatsapp || orderData.contato}</p>` : ''}
                ${orderData.endereco ? `<p style="margin:2px 0; font-size:12px;"><strong>Endereço:</strong> ${orderData.endereco}</p>` : ''}
                ${orderData.mesa ? `<p style="margin:2px 0; font-size:12px;"><strong>Mesa:</strong> ${orderData.mesa}</p>` : ''}
            </div>
        `;
    }

    return `
        <div class="receipt">
            <div class="receipt-header">
                ${headerHTML}
                <p>${isReprint ? 'Reimpressão - ' : ''}${dateStr}</p>
            </div>

            ${clientInfoHTML}

            <div class="receipt-senha" style="font-size:20px; font-weight:bold;">SENHA: ${senhaFmt}</div>
            <p><strong>Pgto:</strong> ${pgto}</p>
            ${valTroco > 0 ? `<p><strong>Troco:</strong> R$ ${valTroco.toFixed(2).replace('.', ',')}</p>` : ''}
            <br>

            <div class="receipt-body">
                ${orderData.items.map(item => `
                    <div class="receipt-item" style="flex-direction: column; align-items: flex-start;">
                        <div style="display: flex; justify-content: space-between; width: 100%;">
                            <span>${item.qty}x ${item.name}</span>
                            <span>R$ ${(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
                        </div>
                        ${item.addons && item.addons.length > 0 ? `<div style="font-size: 0.8em; color: #555; margin-left: 15px;">+ ${item.addons.map(a => a.name).join(', ')}</div>` : ''}
                        ${item.obs ? `<div style="font-size: 0.8em; color: #555; margin-left: 15px;">* Obs: ${item.obs}</div>` : ''}
                    </div>
                `).join('')}
            </div>

            ${(orderData.orderObs || orderData.obsPedido) ? `
                <div style="border-top:1px dashed #ccc; margin-top:10px; padding-top:10px; font-size:0.9em;">
                    <strong>Observação do Pedido:</strong><br>
                    ${orderData.orderObs || orderData.obsPedido}
                </div>
            ` : ''}

            <div class="receipt-total">
                TOTAL: R$ ${orderData.total.toFixed(2).replace('.', ',')}
            </div>

            ${pixQrHTML}

            <div style="text-align:center; margin-top:20px; font-size:10px;">
                ${footerMsg}
            </div>
        </div>
    `;
}

// --- Estoque ---

function renderInventory(filterText = '') {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));

    const datalist = document.getElementById('category-options');
    if (datalist) {
        const uniqueCategories = [...new Set(products.map(p => p.category))].filter(Boolean);
        datalist.innerHTML = uniqueCategories.map(c => `<option value="${c}">`).join('');
    }

    filtered.forEach(p => {
        const isActive = p.active !== false;

        const tr = document.createElement('tr');
        tr.style.opacity = isActive ? '1' : '0.6';
        tr.innerHTML = `
            <td style="text-align:center;">
                <input type="checkbox" class="inventory-checkbox" value="${p.id}" onchange="updateBulkBar()">
            </td>
            <td>
                ${p.name}
                ${p.isAddon ? `<span style="margin-left:5px; font-size:0.7em; background:var(--warning-color); padding:2px 6px; border-radius:4px; color:black;">Adicional</span>` : ''}
            </td>
            <td>${p.category}</td>
            <td>R$ ${p.price.toFixed(2).replace('.', ',')}</td>
            <td class="${p.stock <= 5 ? (p.stock <= 0 ? 'stock-out' : 'stock-low') : ''}">
                ${p.stock}
            </td>
            <td>
                <span style="padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; background-color: ${isActive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${isActive ? 'var(--success-color)' : 'var(--danger-color)'}">
                    ${isActive ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <i class="fa-solid fa-pen-to-square action-icon" onclick="editProduct('${p.id}')" title="Editar Produto"></i>
                <i class="fa-solid ${isActive ? 'fa-eye-slash' : 'fa-eye'} action-icon" onclick="toggleProductStatus('${p.id}')" title="${isActive ? 'Desabilitar Venda' : 'Habilitar Venda'}"></i>
                <i class="fa-solid fa-trash action-icon delete" onclick="deleteProduct('${p.id}')" title="Excluir Definitivo"></i>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Reset select-all e barra de ações
    const selectAll = document.getElementById('select-all-inventory');
    if (selectAll) selectAll.checked = false;
    updateBulkBar();
}

function filterInventory() {
    const text = document.getElementById('search-inventory').value;
    renderInventory(text);
}

// --- Seleção em lote ---

function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('.inventory-checkbox');
    checkboxes.forEach(cb => cb.checked = masterCheckbox.checked);
    updateBulkBar();
}

function updateBulkBar() {
    const checkboxes = document.querySelectorAll('.inventory-checkbox:checked');
    const bar = document.getElementById('bulk-action-bar');
    const count = document.getElementById('bulk-count');
    const total = checkboxes.length;

    if (total > 0) {
        bar.style.display = 'flex';
        count.textContent = `${total} selecionado(s)`;
    } else {
        bar.style.display = 'none';
    }

    // Atualiza estado do select-all
    const allCheckboxes = document.querySelectorAll('.inventory-checkbox');
    const selectAll = document.getElementById('select-all-inventory');
    if (selectAll) selectAll.checked = allCheckboxes.length > 0 && total === allCheckboxes.length;
}

function getSelectedIds() {
    return Array.from(document.querySelectorAll('.inventory-checkbox:checked')).map(cb => String(cb.value));
}

function bulkToggleStatus(activate) {
    const ids = getSelectedIds();
    if (ids.length === 0) return;

    const action = activate ? 'HABILITAR' : 'DESABILITAR';
    showConfirm({
        icon: activate ? '👁️' : '🚫',
        title: `${action} ${ids.length} produto(s)?`,
        msg: `Todos os ${ids.length} produto(s) selecionados serão ${activate ? 'habilitados e aparecerão' : 'desabilitados e desaparecerão'} na frente de caixa.`,
        btnText: action,
        btnColor: activate ? 'var(--success-color)' : 'var(--warning-color, #f59e0b)',
        onConfirm: () => {
            ids.forEach(id => {
                const p = products.find(prod => String(prod.id) === String(id));
                if (p) {
                    p.active = activate;
                    saveProducts(p);
                }
            });
            const text = document.getElementById('search-inventory')?.value || '';
            renderInventory(text);
            renderProducts();
        }
    });
}

function bulkDelete() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;

    showConfirm({
        icon: '🗑️',
        title: `Excluir ${ids.length} produto(s)?`,
        msg: `Tem certeza que deseja excluir DEFINITIVAMENTE ${ids.length} produto(s) do sistema? Esta ação não pode ser desfeita.\n\nDica: Você pode desabilitar os produtos em vez de excluí-los.`,
        btnText: 'Excluir Todos',
        onConfirm: () => {
            products = products.filter(p => !ids.includes(String(p.id)));

            ids.forEach(pid => saveProducts(null, pid));

            const text = document.getElementById('search-inventory')?.value || '';
            renderInventory(text);
            renderProducts();
        }
    });
}

function toggleProductStatus(id) {
    const pid = String(id);
    const p = products.find(prod => String(prod.id) === pid);
    if (!p) return;

    // Alterna o status
    p.active = p.active === false ? true : false;

    saveProducts(p);

    // Mantém o filtro de pesquisa atual
    const text = document.getElementById('search-inventory')?.value || '';
    renderInventory(text);
    renderProducts(); // Atualiza a frente de caixa e remove de lá se inativo
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    // Reseta propriedade oculta original ativa se houver
    document.getElementById('product-form').removeAttribute('data-active');
    document.getElementById('modal-product-title').innerText = 'Adicionar Produto';
    document.getElementById('product-is-addon').checked = false;
}

function saveProduct(e) {
    e.preventDefault();

    const id = document.getElementById('product-id').value;
    const existingActiveStatus = document.getElementById('product-form').getAttribute('data-active');
    const isAddon = document.getElementById('product-is-addon').checked;

    const productData = {
        name: document.getElementById('product-name').value,
        category: document.getElementById('product-category').value,
        price: parseFloat(document.getElementById('product-price').value),
        stock: parseInt(document.getElementById('product-stock').value),
        isAddon: isAddon,
        active: existingActiveStatus !== 'false' // Mantém inativo se estava inativo, senão true 
    };

    if (id) {
        // Edit
        const index = products.findIndex(p => String(p.id) == String(id));
        if (index > -1) {
            products[index] = { ...products[index], ...productData };
            saveProducts(products[index]);
        }
    } else {
        // Add
        productData.id = Date.now();
        products.push(productData);
        saveProducts(productData);
    }

    renderInventory();
    renderProducts();
    closeModal('modal-product');
}

function editProduct(id) {
    const pid = String(id);
    const p = products.find(prod => String(prod.id) === pid);
    if (!p) return;

    document.getElementById('product-id').value = p.id;
    document.getElementById('product-name').value = p.name;
    document.getElementById('product-category').value = p.category;
    document.getElementById('product-price').value = p.price;
    document.getElementById('product-stock').value = p.stock;
    document.getElementById('product-is-addon').checked = p.isAddon === true;

    // Armazena no form para quando salvar não sobrescrever com o padrão (true)
    document.getElementById('product-form').setAttribute('data-active', p.active !== false ? 'true' : 'false');

    document.getElementById('modal-product-title').innerText = 'Editar Produto';
    openModal('modal-product');
}

function deleteProduct(id) {
    showConfirm({
        icon: '🗑️',
        title: 'Excluir Produto?',
        msg: 'Tem certeza que deseja excluir DEFINITIVAMENTE este produto do sistema?\n\nDica: Você pode apenas clicar no ícone do olho para desabilitá-lo momentaneamente e ocultá-lo das vendas sem perder seu histórico e cadastro.',
        btnText: 'Excluir',
        onConfirm: () => {
            const pid = String(id);
            products = products.filter(p => String(p.id) !== pid);
            saveProducts(null, pid);

            const text = document.getElementById('search-inventory')?.value || '';
            renderInventory(text);
            renderProducts();
        }
    });
}

// --- Fechamento e Histórico ---

function renderHistory() {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (salesHistory.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align:center;">Nenhuma venda neste turno ainda.</td>`;
        tbody.appendChild(tr);
        return;
    }

    salesHistory.forEach(sale => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${String(sale.senha).padStart(3, '0')}</td>
            <td style="color: var(--success-color); font-weight:bold;">R$ ${sale.total.toFixed(2).replace('.', ',')}</td>
            <td>${sale.pagamento || sale.支付 || 'Dinheiro'}</td>
            <td style="display: flex; gap: 5px;">
                <button title="Reimprimir Comanda da Cozinha" onclick="printSpecificReceiptFromHistory('comanda', ${sale.senha})" style="cursor: pointer; background: var(--warning-color); color: white; border: none; padding: 5px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fa-solid fa-fire-burner"></i> Comanda</button>
                <button title="Reimprimir Cupom do Cliente" onclick="printSpecificReceiptFromHistory('cupom', ${sale.senha})" style="cursor: pointer; background: #32bcad; color: white; border: none; padding: 5px; border-radius: 4px; font-size: 0.8rem; font-weight: bold;"><i class="fa-solid fa-receipt"></i> Cupom</button>
                <button title="Cancelar Venda" onclick="cancelSale(${sale.senha})" style="cursor: pointer; background: var(--danger-color); color: white; border: none; padding: 5px; border-radius: 4px; font-size: 0.8rem;"><i class="fa-solid fa-ban"></i> Estornar</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function cancelSale(senha) {
    showConfirm({
        icon: '↩️',
        title: 'Estornar Venda?',
        msg: `Tem certeza que deseja CANCELAR a venda da Senha #${String(senha).padStart(3, '0')}?\n\n• Os produtos voltarão para o estoque.\n• O valor será deduzido do caixa.\n• A venda será excluída do histórico do turno.`,
        btnText: 'Estornar',
        onConfirm: () => executeCancelSale(senha)
    });
}

function executeCancelSale(senha) {

    const saleIndex = salesHistory.findIndex(s => s.senha === senha);
    if (saleIndex === -1) return;

    const sale = salesHistory[saleIndex];

    // Devolver itens ao estoque
    sale.items.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) {
            p.stock += item.qty;
            saveProducts(p);
        }
    });

    // Deduzir do caixa (turnos)
    shiftSales.count -= 1;
    shiftSales.total -= sale.total;

    // Remover do histórico
    salesHistory.splice(saleIndex, 1);

    // Salvar estado
    saveShiftData();

    // Re-render
    renderProducts();
    renderInventory();
    renderHistory();
    updateClosureUI();

    alert("Venda estornada com sucesso!");
}

function updateClosureUI() {
    document.getElementById('closure-total-sales').innerText = shiftSales.count;
    document.getElementById('closure-revenue').innerText = `R$ ${shiftSales.total.toFixed(2).replace('.', ',')}`;
}

function closeRegister() {
    let msg;
    if (shiftSales.count === 0) {
        msg = 'Não há vendas neste turno. Deseja imprimir um relatório zerado e reiniciar o caixa mesmo assim?';
    } else {
        msg = `Esta ação imprimirá o relatório de ${shiftSales.count} venda(s) totalizando R$ ${shiftSales.total.toFixed(2).replace('.', ',')} e irá ZERAR o sistema para o próximo turno.`;
    }

    showConfirm({
        icon: '🔒',
        title: 'Fechar o Caixa?',
        msg: msg,
        btnText: '🔒 Fechar e Imprimir',
        btnColor: 'var(--color-primary)',
        onConfirm: confirmarFechamento
    });
}

function confirmarFechamento() {
    // Limpa fila de impressão pendente para evitar conflito com o relatório
    printQueue = [];

    const printArea = document.getElementById('print-area');
    const dateStr = new Date().toLocaleString('pt-BR');

    // Agrupa vendas por método de pagamento
    const byMethod = {};
    salesHistory.forEach(sale => {
        const method = sale.pagamento || 'Outro';
        if (!byMethod[method]) byMethod[method] = { count: 0, total: 0 };
        byMethod[method].count++;
        byMethod[method].total += sale.total;
    });

    const methodRows = Object.entries(byMethod).map(([method, data]) => `
        <div class="receipt-item" style="font-size:13px; padding: 4px 0;">
            <span>${method} (${data.count}x)</span>
            <span>R$ ${data.total.toFixed(2).replace('.', ',')}</span>
        </div>
    `).join('');

    const htmlRelatorio = `
        <div class="receipt">
            <div class="receipt-header">
                <h2>FECHAMENTO DE CAIXA</h2>
                <p>La Casa de Pastel</p>
                <p>${dateStr}</p>
            </div>

            <div style="margin: 16px 0; font-size: 14px;">
                <div class="receipt-item">
                    <span><strong>Total de Senhas:</strong></span>
                    <span><strong>${shiftSales.count}</strong></span>
                </div>
            </div>

            <div style="border-top: 1px dashed black; padding-top: 12px; margin-bottom: 12px;">
                <p style="font-size:11px; font-weight:bold; letter-spacing:1px; margin-bottom:8px;">POR MÉTODO DE PAGAMENTO</p>
                ${methodRows || '<p style="font-size:12px; color:#666;">Nenhuma venda registrada.</p>'}
            </div>

            <div class="receipt-item" style="border-top: 1px dashed black; padding-top: 10px; font-size: 16px; font-weight: bold;">
                <span>TOTAL GERAL:</span>
                <span>R$ ${shiftSales.total.toFixed(2).replace('.', ',')}</span>
            </div>

            <div style="text-align:center; border-top: 1px dashed black; margin-top:24px; padding-top:10px;">
                Assinatura Responsável
                <br><br><br>
                ___________________________________
            </div>
        </div>
    `;

    printArea.innerHTML = htmlRelatorio;

    function onAfterPrintRegister() {
        window.removeEventListener('afterprint', onAfterPrintRegister);

        shiftSales = { count: 0, total: 0 };
        currentOrderNumber = 1;
        salesHistory = [];
        printQueue = [];
        saveShiftData();

        document.getElementById('current-order-number').innerText = `Senha: #${String(currentOrderNumber).padStart(3, '0')}`;
        updateClosureUI();
        renderHistory();
    }

    window.addEventListener('afterprint', onAfterPrintRegister);
    window.print();
}

// --- PIX / Gerenciamento ---
function savePixKey() {
    const key = document.getElementById('pix-key-input').value.trim();
    const name = document.getElementById('pix-merchant-name').value.trim() || 'La Casa de Pastel';
    const city = document.getElementById('pix-merchant-city').value.trim() || 'SAO PAULO';

    if (!key) {
        alert('Por favor insira uma chave PIX!');
        return;
    }
    localStorage.setItem('lacasa_pix_key', key);
    localStorage.setItem('lacasa_merchant_name', name);
    localStorage.setItem('lacasa_merchant_city', city);

    if (typeof FireDB !== 'undefined') {
        FireDB.saveSettings({
            pixKey: key,
            pixMerchantName: name,
            pixMerchantCity: city
        }).catch(e => console.warn('Erro ao salvar config PIX no Firebase:', e));
    }

    alert('Configurações Pix salvas com sucesso!');
    generatePixQR(key);
}

function generatePixQR(key) {
    if (!key) return;
    const qrContainer = document.getElementById('pix-qr-container');
    const qrImg = document.getElementById('pix-qr-img');
    // QR de exemplo (sem valor — apenas exibição na aba de gerenciamento)
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(key)}`;
    qrContainer.style.display = 'block';
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
 * @param {string} pixKey   - Chave Pix (cpf, email, telefone, aleatória)
 * @param {number} amount   - Valor em reais (ex: 12.50)
 * @param {string} name     - Nome do recebedor (max 25 chars)
 * @param {string} city     - Cidade do recebedor (max 15 chars)
 * @param {string} txid     - Identificador da transação (max 25 chars, sem espaços)
 * @param {string} desc     - Descrição opcional (max 40 chars)
 * @returns {string} payload string ("Pix Copia e Cola")
 */
function generatePixBrCode(pixKey, amount, name, city, txid, desc = '') {
    // Sanitiza strings
    const safeName = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 25).trim();
    const safeCity = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().substring(0, 15).trim();
    const safeTxid = (txid || '***').replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';
    const safeDesc = desc.substring(0, 40);

    // ID 26 — Merchant Account Information (Pix)
    let merchantInfo = emvField('00', 'BR.GOV.BCB.PIX');
    merchantInfo += emvField('01', pixKey);
    if (safeDesc) merchantInfo += emvField('02', safeDesc);

    // ID 62 — Additional Data Field Template
    const additionalData = emvField('05', safeTxid);

    // Monta payload sem CRC
    let payload = '';
    payload += emvField('00', '01');                    // Payload Format Indicator
    payload += emvField('26', merchantInfo);             // Merchant Account Info (Pix)
    payload += emvField('52', '0000');                  // MCC
    payload += emvField('53', '986');                   // Currency (BRL)
    payload += emvField('54', amount.toFixed(2));       // Transaction Amount
    payload += emvField('58', 'BR');                    // Country Code
    payload += emvField('59', safeName);                // Merchant Name
    payload += emvField('60', safeCity);                // Merchant City
    payload += emvField('62', additionalData);          // Additional Data
    payload += '6304';                                  // CRC placeholder

    // Calcula e adiciona o CRC
    payload += crc16(payload);
    return payload;
}

/**
 * Gera URL de QR Code a partir do payload Pix (usando api.qrserver.com)
 */
function pixPayloadToQrUrl(payload, size = 300) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&ecc=M&data=${encodeURIComponent(payload)}`;
}

// ============================================================
// --- CONFIGURAÇÃO DO CUPOM ---
// ============================================================

function loadReceiptConfig() {
    const logoType = localStorage.getItem('lacasa_receipt_logo_type') || 'text';
    const logoImage = localStorage.getItem('lacasa_receipt_logo_image');
    const footerMsg = localStorage.getItem('lacasa_receipt_footer_msg') || '';
    const receiptName = localStorage.getItem('lacasa_receipt_name') || '';

    const nameInput = document.getElementById('receipt-name');
    if (nameInput && receiptName) nameInput.value = receiptName;

    const msgInput = document.getElementById('receipt-footer-msg');
    if (msgInput && footerMsg) msgInput.value = footerMsg;

    // Logo preview
    if (logoImage) {
        const preview = document.getElementById('logo-preview');
        const wrap = document.getElementById('logo-preview-wrap');
        if (preview) preview.src = logoImage;
        if (wrap) wrap.style.display = 'block';
    }

    toggleLogoType(logoType, false); // false = sem salvar
}

function toggleLogoType(type, doSave = false) {
    const textArea = document.getElementById('logo-text-area');
    const imgArea = document.getElementById('logo-image-area');
    const btnText = document.getElementById('btn-logo-text');
    const btnImg = document.getElementById('btn-logo-image');

    if (!textArea) return;

    if (type === 'image') {
        textArea.style.display = 'none';
        imgArea.style.display = 'block';
        btnText.classList.remove('logo-toggle-active');
        btnImg.classList.add('logo-toggle-active');
    } else {
        textArea.style.display = 'block';
        imgArea.style.display = 'none';
        btnText.classList.add('logo-toggle-active');
        btnImg.classList.remove('logo-toggle-active');
    }

    if (doSave) localStorage.setItem('lacasa_receipt_logo_type', type);
}

function handleLogoUpload(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Redimensiona via canvas para não pesar no localStorage
        const img = new Image();
        img.onload = () => {
            const MAX = 400;
            const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/png', 0.85);

            localStorage.setItem('lacasa_receipt_logo_image', dataUrl);
            const preview = document.getElementById('logo-preview');
            const wrap = document.getElementById('logo-preview-wrap');
            if (preview) { preview.src = dataUrl; }
            if (wrap) { wrap.style.display = 'block'; }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function removeLogoImage() {
    localStorage.removeItem('lacasa_receipt_logo_image');
    const preview = document.getElementById('logo-preview');
    const wrap = document.getElementById('logo-preview-wrap');
    const input = document.getElementById('logo-upload');
    if (preview) preview.src = '';
    if (wrap) wrap.style.display = 'none';
    if (input) input.value = '';
}

function saveReceiptConfig() {
    const logoType = document.getElementById('btn-logo-image').classList.contains('logo-toggle-active') ? 'image' : 'text';
    const receiptName = (document.getElementById('receipt-name')?.value.trim() || 'LA CASA DE PASTEL').toUpperCase();
    const footerMsg = document.getElementById('receipt-footer-msg')?.value.trim() || 'Obrigado pela preferência e volte sempre!';

    localStorage.setItem('lacasa_receipt_logo_type', logoType);
    localStorage.setItem('lacasa_receipt_name', receiptName);
    localStorage.setItem('lacasa_receipt_footer_msg', footerMsg);

    alert('Configurações do cupom salvas!');
}

// ============================================================
// --- HORÁRIO DE FUNCIONAMENTO ---
// ============================================================

const DAYS_PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function renderStoreHoursGrid() {
    const grid = document.getElementById('store-hours-grid');
    if (!grid) return;

    const saved = JSON.parse(localStorage.getItem('lacasa_store_hours') || 'null');

    grid.innerHTML = DAYS_PT.map((day, i) => {
        const d = saved ? saved[i] : { open: '08:00', close: '18:00', enabled: i >= 1 && i <= 6 };
        return `
            <div style="display:flex; align-items:center; gap:10px; padding:6px 0; ${!d.enabled ? 'opacity:0.5' : ''}">
                <input type="checkbox" class="day-enabled" data-day="${i}" ${d.enabled ? 'checked' : ''} 
                    style="accent-color:var(--success-color);" onchange="this.parentElement.style.opacity = this.checked ? '1' : '0.5'">
                <span style="width:80px; font-size:0.9rem; font-weight:600;">${day}</span>
                <input type="time" class="day-open" data-day="${i}" value="${d.open}"
                    style="padding:5px 8px; background:var(--bg-panel); border:1px solid var(--border-color); color:white; border-radius:5px; font-size:0.85rem;">
                <span style="color:var(--color-text-muted);">às</span>
                <input type="time" class="day-close" data-day="${i}" value="${d.close}"
                    style="padding:5px 8px; background:var(--bg-panel); border:1px solid var(--border-color); color:white; border-radius:5px; font-size:0.85rem;">
            </div>
        `;
    }).join('');
}

function saveStoreHours() {
    const hours = DAYS_PT.map((_, i) => ({
        enabled: document.querySelector(`.day-enabled[data-day="${i}"]`)?.checked || false,
        open: document.querySelector(`.day-open[data-day="${i}"]`)?.value || '08:00',
        close: document.querySelector(`.day-close[data-day="${i}"]`)?.value || '18:00'
    }));
    localStorage.setItem('lacasa_store_hours', JSON.stringify(hours));

    // Salva também no Firebase se disponível
    if (typeof FireDB !== 'undefined') {
        FireDB.saveSettings({ storeHours: hours }).catch(() => { });
    }

    alert('Horários salvos com sucesso!');
}

function setStoreManual(mode) {
    // mode: 'open', 'close', 'auto'
    localStorage.setItem('lacasa_store_mode', mode);

    // Atualiza botões
    document.querySelectorAll('.store-toggle-btn').forEach(b => b.classList.remove('active'));
    const btnMap = { open: 'btn-open-store', auto: 'btn-auto-store', close: 'btn-close-store' };
    const btn = document.getElementById(btnMap[mode]);
    if (btn) btn.classList.add('active');

    // Atualiza status visual
    const icon = document.getElementById('store-status-icon');
    const label = document.getElementById('store-status-label');
    const desc = document.getElementById('store-status-desc');

    if (mode === 'open') {
        if (icon) { icon.className = 'store-status-icon store-open'; icon.innerHTML = '<i class="fa-solid fa-store"></i>'; }
        if (label) label.textContent = 'Loja Aberta';
        if (desc) desc.textContent = 'Forçado manualmente — ignorando horário';
    } else if (mode === 'close') {
        if (icon) { icon.className = 'store-status-icon store-closed'; icon.innerHTML = '<i class="fa-solid fa-store-slash"></i>'; }
        if (label) label.textContent = 'Loja Fechada';
        if (desc) desc.textContent = 'Forçado manualmente — clientes verão "Fechado"';
    } else {
        if (icon) { icon.className = 'store-status-icon store-auto'; icon.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>'; }
        if (label) label.textContent = 'Modo Automático';
        if (desc) desc.textContent = 'Seguindo o horário configurado abaixo';
    }

    // Salva no Firebase
    if (typeof FireDB !== 'undefined') {
        FireDB.saveSettings({
            storeOverride: mode === 'open' ? true : false,
            storeForceClosed: mode === 'close' ? true : false,
            storeMode: mode
        }).catch(() => { });
    }
}

function loadStoreMode() {
    const mode = localStorage.getItem('lacasa_store_mode') || 'auto';
    setStoreManual(mode);
}

function isStoreOpen() {
    const mode = localStorage.getItem('lacasa_store_mode') || 'auto';

    if (mode === 'open') return true;
    if (mode === 'close') return false;

    // Modo automático: verifica horário
    const hours = JSON.parse(localStorage.getItem('lacasa_store_hours') || 'null');
    if (!hours) return true; // Se não configurou, assume aberto

    const now = new Date();
    const dayConfig = hours[now.getDay()];
    if (!dayConfig || !dayConfig.enabled) return false;

    const currentTime = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = dayConfig.open.split(':').map(Number);
    const [closeH, closeM] = dayConfig.close.split(':').map(Number);

    return currentTime >= (openH * 60 + openM) && currentTime <= (closeH * 60 + closeM);
}

// ============================================================
// --- APROVAÇÃO DE PEDIDOS ---
// ============================================================

function saveAutoApprove() {
    const auto = document.getElementById('auto-approve-toggle')?.checked || false;
    localStorage.setItem('lacasa_auto_approve', auto ? 'true' : 'false');

    if (typeof FireDB !== 'undefined') {
        FireDB.saveSettings({ autoApprove: auto }).catch(() => { });
    }
}

function loadAutoApprove() {
    const auto = localStorage.getItem('lacasa_auto_approve') === 'true';
    const toggle = document.getElementById('auto-approve-toggle');
    if (toggle) toggle.checked = auto;
}

// ============================================================
// --- NOTIFICAÇÕES PUSH (FCM) ---
// ============================================================

function saveFCMKey() {
    const key = document.getElementById('fcm-server-key').value.trim();
    localStorage.setItem('lacasa_fcm_server_key', key);
    alert('✅ Server Key do Firebase salva com sucesso no seu navegador.');
}

function loadFCMKeyUI() {
    const key = localStorage.getItem('lacasa_fcm_server_key');
    if (key) {
        document.getElementById('fcm-server-key').value = key;
    }
}

async function sendPushNotification(token, title, body) {
    if (!token) return;

    const serverKey = localStorage.getItem('lacasa_fcm_server_key');
    if (!serverKey) {
        console.warn('FCM Server Key não configurada no painel Gerenciamento. Notificação ignorada.');
        return;
    }

    try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${serverKey}`
            },
            body: JSON.stringify({
                to: token,
                notification: {
                    title: title,
                    body: body,
                    icon: '/cliente/icon-192.png' // Assumindo que você vai pôr um icone aqui
                }
            })
        });

        if (response.ok) {
            console.log("Push enviado com sucesso para o cliente.");
        } else {
            console.error("Falha ao enviar Push:", await response.text());
        }
    } catch (error) {
        console.error("Erro na requisição FCM:", error);
    }
}

// ============================================================
// --- PEDIDOS ONLINE (Painel PDV) ---
// ============================================================

let onlineOrders = [];
let _notifAudio = null;

function initNotificationSound() {
    // Cria um beep curto via AudioContext
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        _notifAudio = { ctx, osc, gain };
    } catch (e) { /* sem som */ }
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
    } catch (e) { /* sem som */ }
}

function renderOnlineOrders(orders) {
    const list = document.getElementById('online-orders-list');
    const empty = document.getElementById('online-orders-empty');
    if (!list) return;

    onlineOrders = orders;

    if (orders.length === 0) {
        list.innerHTML = '';
        if (empty) empty.style.display = 'flex';
        return;
    }

    if (empty) empty.style.display = 'none';

    const statusColors = {
        pendente: 'rgba(245, 158, 11, 0.2)',
        aprovado: 'rgba(59, 130, 246, 0.2)',
        preparando: 'rgba(139, 92, 246, 0.2)',
        pronto: 'rgba(16, 185, 129, 0.2)',
        recusado: 'rgba(239, 68, 68, 0.2)'
    };

    const statusLabels = {
        pendente: '⏳ Pendente',
        aprovado: '✅ Aprovado',
        preparando: '🔥 Preparando',
        pronto: '✔️ Pronto',
        recusado: '❌ Recusado'
    };

    const tipoIcons = {
        entrega: '🛵 Entrega',
        retirada: '🏪 Retirada',
        local: '🍽️ No Local'
    };

    list.innerHTML = orders.map(order => {
        const items = (order.items || []).map(it => `<span>${it.qty}x ${it.name}</span>`).join('<br>');
        const status = order.status || 'pendente';
        const isPending = status === 'pendente';
        const createdAt = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleString('pt-BR') : '';

        return `
            <div class="order-card ${isPending ? 'order-pending' : ''}" style="background:${statusColors[status] || 'var(--bg-dark)'}; border:1px solid var(--border-color); border-radius:10px; padding:16px; ${isPending ? 'animation: pulse-border 1.5s infinite;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <strong style="font-size:1.1rem;">#${order.id.slice(-4).toUpperCase()}</strong>
                        ${order.contato ? `
                            <a href="https://wa.me/55${order.contato.replace(/\D/g, '')}" target="_blank" title="Abrir WhatsApp" style="color:#25d366; font-size:1.2rem; text-decoration:none;">
                                <i class="fa-brands fa-whatsapp"></i>
                            </a>
                        ` : ''}
                    </div>
                    <span style="font-size:0.8rem; padding:4px 8px; border-radius:20px; background:var(--bg-panel);">${statusLabels[status] || status}</span>
                </div>
                <div style="font-size:0.85rem; color:var(--color-text-muted); margin-bottom:8px;">${createdAt}</div>
                <div style="font-size:0.85rem; margin-bottom:8px;">${tipoIcons[order.tipo] || order.tipo || 'N/A'}</div>
                <div style="font-size:0.88rem; margin-bottom:8px; line-height:1.5;">${items}</div>
                <div style="font-weight:bold; font-size:1.05rem; margin-bottom:8px;">Total: R$ ${(order.total || 0).toFixed(2).replace('.', ',')}</div>
                ${order.contato ? `<div style="font-size:0.82rem; color:var(--color-text-muted);">📱 ${order.contato}</div>` : ''}
                ${order.endereco ? `<div style="font-size:0.82rem; color:var(--color-text-muted);">📍 ${order.endereco}</div>` : ''}
                ${order.senhaGerada ? `<div style="font-size:0.85rem; color:var(--warning-color); font-weight:bold; margin-top:4px;">🔑 Senha do Cliente: ${order.senhaGerada}</div>` : ''}
                
                <!-- Mensagem Direta -->
                <div style="margin-top:12px; border-top:1px solid rgba(255,255,255,0.05); padding-top:12px;">
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="msg-${order.id}" placeholder="Enviar mensagem rápida..." 
                               style="flex:1; background:rgba(0,0,0,0.2); border:1px solid var(--border-color); color:white; padding:6px 10px; border-radius:6px; font-size:0.85rem;">
                        <button onclick="sendDirectMessage('${order.id}')" style="background:var(--color-primary); color:white; border:none; border-radius:6px; padding:0 10px; cursor:pointer;">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                    ${order.lastMessage ? `<div style="font-size:0.75rem; color:var(--success-color); margin-top:4px;">Enviada: "${order.lastMessage}"</div>` : ''}
                </div>

                <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
                    ${isPending ? `
                        <button onclick="updateOrderStatus('${order.id}', 'aprovado')" style="padding:6px 12px; border:none; border-radius:6px; background:var(--success-color); color:white; cursor:pointer; font-weight:600; font-size:0.82rem;">
                            ✅ Aprovar
                        </button>
                        <button onclick="updateOrderStatus('${order.id}', 'recusado')" style="padding:6px 12px; border:none; border-radius:6px; background:var(--danger-color); color:white; cursor:pointer; font-weight:600; font-size:0.82rem;">
                            ❌ Recusar
                        </button>
                    ` : ''}
                    ${status === 'aprovado' ? `
                        <button onclick="updateOrderStatus('${order.id}', 'preparando')" style="padding:6px 12px; border:none; border-radius:6px; background:#8b5cf6; color:white; cursor:pointer; font-weight:600; font-size:0.82rem;">
                            🔥 Preparando
                        </button>
                    ` : ''}
                    ${status === 'preparando' ? `
                        <button onclick="updateOrderStatus('${order.id}', 'pronto')" style="padding:6px 12px; border:none; border-radius:6px; background:var(--success-color); color:white; cursor:pointer; font-weight:600; font-size:0.82rem;">
                            ✔️ Pronto
                        </button>
                    ` : ''}
                    ${status === 'pronto' ? `
                        <button onclick="updateOrderStatus('${order.id}', 'entregue')" style="padding:6px 12px; border:none; border-radius:6px; background:var(--color-primary); color:white; cursor:pointer; font-weight:600; font-size:0.82rem;">
                            📦 Finalizar
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function sendDirectMessage(orderId) {
    const input = document.getElementById(`msg-${orderId}`);
    const msg = input ? input.value.trim() : '';
    if (!msg) return;

    if (typeof FireDB !== 'undefined') {
        FireDB.updateOrderStatus(orderId, null, msg).then(() => {
            input.value = '';
        }).catch(err => alert('Erro ao enviar mensagem: ' + err.message));
    }
}

function updateOrderStatus(orderId, newStatus) {
    if (typeof FireDB !== 'undefined') {
        FireDB.updateOrderStatus(orderId, newStatus).catch(err => {
            alert('Erro ao atualizar pedido: ' + err.message);
        });

        // Tenta enviar Push Notification e Imprimir (se aprovado)
        if (newStatus === 'aprovado' || newStatus === 'preparando' || newStatus === 'pronto' || newStatus === 'recusado') {
            db.collection('orders').doc(orderId).get().then(doc => {
                if (doc.exists) {
                    const orderData = doc.data();

                    // --- 1. IMPRESSÃO AUTOMÁTICA E INSERÇÃO NO HISTÓRICO SE APROVADO ---
                    if (newStatus === 'aprovado') {
                        let orderToPrint = { ...orderData };
                        if (!orderToPrint.senha) {
                            orderToPrint.senha = currentOrderNumber;
                            currentOrderNumber++;
                        }

                        console.log("🖨️ Imprimindo pedido online aprovado e inserindo no histórico de vendas...");

                        // Incrementa fechamento de caixa
                        shiftSales.count++;
                        shiftSales.total += (orderToPrint.total || 0);

                        // Insere no histórico do caixa atual
                        salesHistory.unshift(orderToPrint);
                        saveShiftData();       // Salva no localStorage (Fechamento)

                        try {
                            if (typeof updateClosureUI === 'function') updateClosureUI();
                            if (typeof renderHistory === 'function') renderHistory();

                            if (typeof printSequentialReceipts === 'function') {
                                printSequentialReceipts(orderToPrint);
                            }
                        } catch (e) { console.warn("Erro ao atualizar histórico ou imprimir:", e); }
                    }

                    // --- 2. DISPARO DE PUSH ---
                    if (orderData.fcmToken) {
                        let title, body;
                        if (newStatus === 'aprovado') {
                            title = "✅ Pedido Aprovado";
                            body = `Seu pedido ${orderId.slice(-4).toUpperCase()} foi aceito pela loja!`;
                        } else if (newStatus === 'preparando') {
                            title = "🔥 Pedido em Preparo";
                            body = `Seu pedido ${orderId.slice(-4).toUpperCase()} está sendo preparado!`;
                        } else if (newStatus === 'pronto') {
                            title = "🎉 Pedido Pronto!";
                            body = `Seu pedido ${orderId.slice(-4).toUpperCase()} está pronto para você!`;
                        } else if (newStatus === 'recusado') {
                            title = "❌ Pedido Recusado";
                            body = `Seu pedido ${orderId.slice(-4).toUpperCase()} foi recusado pela loja.`;
                        }

                        if (title && body) {
                            sendPushNotification(orderData.fcmToken, title, body);
                        }
                    }
                }
            }).catch(e => console.warn('Erro ao checar token para notificação:', e));
        }
    }
}

function startOrdersListener() {
    if (typeof FireDB === 'undefined' || !db) {
        console.warn('startOrdersListener: FireDB ou db não disponível');
        return;
    }

    console.log('🔔 Iniciando listener de pedidos...');

    let firstLoad = true;

    try {
        const unsubscribe = FireDB.onNewOrders((orders) => {
            console.log(`📦 Pedidos recebidos: ${orders.length} pedido(s)`);

            const pendingCount = orders.filter(o => o.status === 'pendente').length;

            // Notifica novo pedido (não no primeiro carregamento)
            if (!firstLoad && pendingCount > 0) {
                playNotificationSound();
            }
            firstLoad = false;

            // Badge inline no painel
            const badge = document.getElementById('badge-pedidos');
            if (badge && pendingCount > 0) {
                badge.textContent = pendingCount;
                badge.style.display = 'inline-block';
            } else if (badge) {
                badge.style.display = 'none';
            }

            renderOnlineOrders(orders);
        });

        console.log('✅ Listener de pedidos ativo');
    } catch (e) {
        console.error('❌ Erro ao iniciar listener:', e);

        // Fallback: polling a cada 15 segundos
        console.log('🔄 Usando polling como fallback...');
        setInterval(async () => {
            try {
                const snap = await db.collection('orders')
                    .where('status', 'in', ['pendente', 'aprovado', 'preparando', 'pronto'])
                    .get();
                const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                orders.sort((a, b) => {
                    const tA = a.createdAt?.toMillis?.() || 0;
                    const tB = b.createdAt?.toMillis?.() || 0;
                    return tB - tA;
                });
                renderOnlineOrders(orders);

                const pendingCount = orders.filter(o => o.status === 'pendente').length;
                const badge = document.getElementById('badge-pedidos');
                if (badge && pendingCount > 0) {
                    badge.textContent = pendingCount;
                    badge.style.display = 'inline-block';
                } else if (badge) {
                    badge.style.display = 'none';
                }
            } catch (err) {
                console.warn('Polling erro:', err.message);
            }
        }, 15000);
    }
}

// Função de teste: cria um pedido e verifica se chega
async function testOrderFlow() {
    if (typeof FireDB === 'undefined') {
        alert('FireDB não disponível');
        return;
    }

    try {
        const testOrder = {
            items: [{ name: 'TESTE - Pastel de Queijo', price: 10.00, qty: 1 }],
            total: 10.00,
            tipo: 'retirada',
            pagamento: 'Dinheiro',
            contato: 'Teste - (00) 00000-0000',
            nome: 'Pedido Teste',
            whatsapp: '00000000000',
            status: 'pendente'
        };

        const orderId = await FireDB.createOrder(testOrder);
        alert('✅ Pedido teste criado com ID: ' + orderId + '\n\nSe o listener estiver funcionando, ele aparecerá no painel de Pedidos Online em alguns segundos.');
    } catch (e) {
        alert('❌ Erro ao criar pedido teste: ' + e.message);
    }
}

// ============================================================
// --- INICIALIZAÇÃO ---
// ============================================================

// (Inicialização unificada acima, na linha ~70)

// ============================================================
// --- MONITOR DE CONEXÃO ---
// ============================================================

function initConnectionMonitor() {
    updateConnectionStatus(navigator.onLine);

    window.addEventListener('online', () => {
        updateConnectionStatus(true);
        console.log('🟢 Conexão restaurada — dados serão sincronizados automaticamente.');
    });

    window.addEventListener('offline', () => {
        updateConnectionStatus(false);
        console.log('🔴 Sem conexão — trabalhando no modo offline.');
    });
}

function updateConnectionStatus(isOnline) {
    const el = document.getElementById('conn-status');
    if (!el) return;

    if (isOnline) {
        el.className = 'conn-indicator conn-online';
        el.title = 'Conectado à internet';
        el.querySelector('.conn-label').textContent = 'Online';
    } else {
        el.className = 'conn-indicator conn-offline';
        el.title = 'Sem conexão — modo offline';
        el.querySelector('.conn-label').textContent = 'Offline';
    }
}

// ============================================================
// --- DIAGNÓSTICO FIREBASE ---
// ============================================================

async function runFirebaseDiagnostic() {
    const results = [];

    // Test 1: FireDB exists?
    if (typeof FireDB === 'undefined') {
        results.push('❌ FireDB não carregou');
        showDiagnostic(results);
        return;
    }
    results.push('✅ FireDB carregado');

    // Test 2: Firestore db exists?
    if (typeof db === 'undefined') {
        results.push('❌ Firestore db não inicializou');
        showDiagnostic(results);
        return;
    }
    results.push('✅ Firestore db inicializado');

    // Test 3: Can read products?
    try {
        const prods = await FireDB.loadProducts();
        results.push(`✅ Leitura OK — ${prods.length} produto(s) no Firebase`);
    } catch (e) {
        results.push('❌ Erro ao ler produtos: ' + e.message);
    }

    // Test 4: Can read orders?
    try {
        const snap = await db.collection('orders').limit(5).get();
        results.push(`✅ Pedidos OK — ${snap.docs.length} pedido(s) encontrado(s)`);
    } catch (e) {
        results.push('❌ Erro ao ler pedidos: ' + e.message);
    }

    // Test 5: Can write?
    try {
        await db.collection('settings').doc('_diagnostic').set({
            test: true,
            timestamp: new Date().toISOString()
        });
        await db.collection('settings').doc('_diagnostic').delete();
        results.push('✅ Escrita/Exclusão OK');
    } catch (e) {
        results.push('❌ Erro ao escrever: ' + e.message);
    }

    // Test 6: Products loaded locally?
    results.push(`ℹ️ ${products.length} produto(s) carregados localmente`);

    showDiagnostic(results);
}

function showDiagnostic(results) {
    console.log('=== DIAGNÓSTICO FIREBASE ===');
    results.forEach(r => console.log(r));
    console.log('============================');

    // Mostra banner visual
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1a2e;color:white;padding:12px 20px;z-index:99999;font-family:monospace;font-size:13px;border-bottom:2px solid #e50914;max-height:50vh;overflow:auto;';
    banner.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong>🔧 Diagnóstico Firebase</strong>
            <button onclick="this.parentElement.parentElement.remove()" style="background:#e50914;color:white;border:none;padding:4px 12px;border-radius:4px;cursor:pointer;">Fechar</button>
        </div>
        ${results.map(r => `<div style="padding:2px 0;">${r}</div>`).join('')}
    `;
    document.body.prepend(banner);
}
function checkAppUpdates() {
    const btn = event?.currentTarget;
    const label = document.getElementById('update-status-label');

    if (btn) btn.disabled = true;
    if (label) {
        label.style.display = 'inline';
        label.textContent = 'Verificando...';
        label.style.color = 'var(--color-primary)';
    }

    try {
        if (window.require) {
            const { remote } = window.require('electron');
            // Since we use global Menu in main.js, we can also trigger the main process 
            // function via a simple trick or just let the main process handle the version logic.
            // For simplicity and to be "blindado", we'll use IPC or a direct call if possible.
            // Since we have nodeIntegration: true, we can reach the main checkUpdates via a custom bridge
            // or just reload the app which triggers it anyway. 
            // Better yet, let's just use the Menu we already created.

            // If the user clicked the button, we tell them to check the System Menu 
            // or we could use IPC. Let's assume we want the button to WORK.
            const { ipcRenderer } = window.require('electron');
            // We'll add an IPC listener in main.js to handle this.
            if (ipcRenderer) {
                ipcRenderer.send('check-for-updates-manual');
            }
        }
    } catch (e) {
        console.error('Erro ao chamar atualização:', e);
    }

    setTimeout(() => {
        if (btn) btn.disabled = false;
        if (label) label.style.display = 'none';
    }, 2000);
}
