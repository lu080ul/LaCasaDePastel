import logoIcon from '../assets/logo.png';
import QRCode from 'qrcode';

// Pix Payload Generation Logic (BR Code)
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

function emvField(id, value) {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

export function generatePixBrCode(pixKey, amount, name, city, txid, desc = '') {
  // 1. Sanitização da Chave Pix
  let cleanKey = pixKey.trim();
  if (!cleanKey.includes('@')) { 
      // Remove todos os caracteres não-alfanuméricos (exceto o + se o usuário já tiver colocado)
      cleanKey = cleanKey.replace(/[^\w+]/g, '');
  }

  // 2. Formatação conforme padrão EMV (Maiúsculas, sem acentos, caracteres restritos)
  const cleanEMV = (val, maxLen) => {
    return (val || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .substring(0, maxLen)
      .trim();
  };

  const safeName = cleanEMV(name || 'LA CASA', 25);
  const safeCity = cleanEMV(city || 'SAO PAULO', 15);
  const safeTxid = '***'; // Padrão mais compatível para QR Estático em máquinas de cartão e POS
  const safeDesc = desc.substring(0, 40);

  let merchantInfo = emvField('00', 'BR.GOV.BCB.PIX');
  merchantInfo += emvField('01', cleanKey);
  if (safeDesc) merchantInfo += emvField('02', safeDesc);

  const additionalData = emvField('05', safeTxid);

  let payload = '';
  payload += emvField('00', '01');
  payload += emvField('26', merchantInfo);
  payload += emvField('52', '0000');
  payload += emvField('53', '986');
  payload += emvField('54', amount.toFixed(2));
  payload += emvField('58', 'BR');
  payload += emvField('59', safeName);
  payload += emvField('60', safeCity);
  payload += emvField('62', additionalData);
  payload += '6304';

  payload += crc16(payload);
  return payload;
}

/**
 * Gera um Data URL (base64) do QR Code localmente — funciona 100% offline.
 * Substituiu a versão antiga que dependia de api.qrserver.com.
 */
export async function pixPayloadToDataUrl(payload, size = 200) {
  try {
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('Erro ao gerar QR Code PIX:', err);
    return null;
  }
}

// Print Logic
let printQueue = [];

// Setup queue processor once
if (typeof window !== 'undefined') {
  window.addEventListener('afterprint', () => {
      if (printQueue.length > 0) {
          setTimeout(processPrintQueue, 500);
      }
  });
}

function getPrintArea() {
  let area = document.getElementById('print-area');
  if (!area) {
      area = document.createElement('div');
      area.id = 'print-area';
      area.className = 'print-area';
      document.body.appendChild(area);
      
      // Inject print styles if not exist
      if (!document.getElementById('receipt-print-styles')) {
          const style = document.createElement('style');
          style.id = 'receipt-print-styles';
          style.innerHTML = `
              @media screen { .print-area { display: none; } }
              @media print {
                  body * { visibility: hidden; }
                  html, body { width: 80mm; margin: 0; padding: 0; font-family: monospace; background: white; }
                  .print-area, .print-area * { visibility: visible; }
                  .print-area { position: absolute; left: 0; top: 0; width: 100%; font-size: 14px; padding: 10px; color: black; }
                  .receipt-header { text-align: center; margin-bottom: 10px; }
                  .receipt-senha { font-size: 24px; font-weight: bold; text-align: center; margin: 10px 0; border: 2px dashed black; padding: 10px; }
                  .receipt-item { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight:bold; }
                  .receipt-total { font-weight: bold; font-size: 18px; margin-top: 10px; border-top: 2px dashed black; padding-top: 5px; }
              }
          `;
          document.head.appendChild(style);
      }
  }
  return area;
}

function processPrintQueue() {
  if (printQueue.length === 0) return;
  const htmlInfo = printQueue.shift();
  const area = getPrintArea();
  area.innerHTML = htmlInfo;

  const imgs = Array.from(area.querySelectorAll('img'));
  if (imgs.length === 0) { window.print(); return; }

  let loaded = 0;
  const proceed = () => { loaded++; if (loaded >= imgs.length) window.print(); };
  imgs.forEach(img => {
      if (img.complete) { proceed(); }
      else { img.onload = proceed; img.onerror = proceed; }
  });
}

export async function printSequentialReceipts(orderData) {
  const comandaHTML = generateComandaHTML(orderData, false);
  const cupomHTML = await generateCupomHTML(orderData, false);

  // Coloca o Cupom na fila para imprimir em seguida
  printQueue.push(cupomHTML);

  // Dispara a impressão da Comanda AGORA
  const area = getPrintArea();
  area.innerHTML = comandaHTML;
  setTimeout(() => window.print(), 100); // Allow DOM to update
}

export async function printSpecificReceipt(type, orderData) {
  let html = '';
  if (type === 'comanda') {
      html = generateComandaHTML(orderData, true);
  } else {
      html = await generateCupomHTML(orderData, true);
  }
  const area = getPrintArea();
  area.innerHTML = html;
  setTimeout(() => window.print(), 100);
}

export function printClosureReport(salesHistory, shiftSales) {
  const html = generateClosureReportHTML(salesHistory, shiftSales);
  const area = getPrintArea();
  area.innerHTML = html;
  setTimeout(() => window.print(), 100);
}

function generateComandaHTML(orderData, isReprint = false) {
  const dateStr = new Date().toLocaleString('pt-BR');
  const senhaFmt = String(orderData.senha).padStart(3, '0');
  const customLogo = localStorage.getItem('lacasa_receipt_logo');
  const logoSrc = customLogo ? customLogo : logoIcon;
  
  return `
      <div class="receipt">
          <div class="receipt-header">
              <h2>Cozinha</h2>
              <p>${isReprint ? 'Reimpressão - ' : ''}${dateStr}</p>
          </div>
          <div class="receipt-senha">SENHA: ${senhaFmt}</div>
          <div class="receipt-body">
              ${orderData.items.map(item => `
                  <div class="receipt-item">
                      <span>[ ${item.qty}x ] ${item.name}</span>
                  </div>
                  ${item.observation ? `<div style="font-size: 12px; margin-left: 10px; font-weight: bold; margin-bottom: 2px;">Obs: ${item.observation}</div>` : ''}
                  ${(item.addons || []).map(ad => `<div style="font-size: 12px; margin-left: 10px; margin-bottom: 2px;">+ ${ad.name}</div>`).join('')}
              `).join('')}
              ${orderData.observation ? `
                  <div style="border-top: 1px dashed black; margin-top: 10px; padding-top: 10px; font-weight: bold; text-align: center;">OBSERVAÇÃO GERAL</div>
                  <div style="font-size: 14px; text-align: center; margin-bottom: 10px;">${orderData.observation}</div>
              ` : ''}
          </div>
          <div style="text-align:center; border-top: 1px dashed black; margin-top:20px; padding-top:20px;">
              *** CORTE / ENTREGAR NA COZINHA ***
          </div>
      </div>
  `;
}

async function generateCupomHTML(orderData, isReprint = false) {
  const dateStr = new Date().toLocaleString('pt-BR');
  const senhaFmt = String(orderData.senha).padStart(3, '0');
  const pag = orderData.pagamento || 'Dinheiro';
  const troco = orderData.troco || 0;

  const receiptName = localStorage.getItem('lacasa_receipt_name') || 'LA CASA DE PASTEL';
  const footerMsg = localStorage.getItem('lacasa_receipt_footer_msg') || 'Obrigado pela preferência!';

  let pixQrHTML = '';
  if (orderData.pixPayload) {
      const qrDataUrl = await pixPayloadToDataUrl(orderData.pixPayload, 200);
      if (qrDataUrl) {
          pixQrHTML = `
              <div style="text-align:center; border-top:1px dashed black; margin-top:15px; padding-top:15px;">
                  <p style="font-size:11px; font-weight:bold; margin-bottom:6px;">PAGUE VIA PIX</p>
                  <img src="${qrDataUrl}" alt="QR Code Pix" style="width:160px; height:160px; display:block; margin:0 auto;" />
                  <p style="font-size:10px; margin-top:4px;">Escaneie com o app do seu banco</p>
              </div>
          `;
      }
  }

  const customLogo = localStorage.getItem('lacasa_receipt_logo');
  const logoSrc = customLogo ? customLogo : logoIcon;

  return `
      <div class="receipt">
          <div class="receipt-header">
              <img src="${logoSrc}" alt="${receiptName}" style="width: 130px; height: auto; object-fit: contain; margin: 0 auto 10px auto; display: block;" />
              <p>${isReprint ? 'Reimpressão - ' : ''}${dateStr}</p>
          </div>
          <div class="receipt-senha" style="font-size:20px;">SENHA: ${senhaFmt}</div>
          <p><strong>Pgto:</strong> ${pag}</p>
          ${troco > 0 ? `<p><strong>Troco:</strong> R$ ${troco.toFixed(2)}</p>` : ''}
          <br/>
          <div class="receipt-body">
              ${orderData.items.map(item => {
                  const itemTotalPrice = (item.price + (item.addons || []).reduce((sum, ad) => sum + (parseFloat(ad.price)||0), 0)) * item.qty;
                  return `
                      <div class="receipt-item">
                          <span>${item.qty}x ${item.name}</span>
                          <span>R$ ${itemTotalPrice.toFixed(2)}</span>
                      </div>
                      ${item.observation ? `<div style="font-size: 11px; margin-left: 10px; margin-top:-3px; margin-bottom:3px;">Obs: ${item.observation}</div>` : ''}
                      ${(item.addons || []).map(ad => `<div style="font-size: 11px; margin-left: 10px; display: flex; justify-content: space-between; margin-top:-3px; margin-bottom:3px;"><span>+ ${ad.name}</span><span>R$ ${parseFloat(ad.price||0).toFixed(2)}</span></div>`).join('')}
                  `;
              }).join('')}
              ${orderData.observation ? `
                  <div style="margin-top: 10px; font-weight: bold; text-align: center; font-size: 11px;">OBSERVAÇÃO GERAL</div>
                  <div style="font-size: 12px; text-align: center; margin-bottom: 5px;">${orderData.observation}</div>
              ` : ''}
          </div>
          <div class="receipt-total">
              ${(orderData.discount > 0) ? `
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:normal; margin-bottom:2px;">
                  <span>Subtotal:</span>
                  <span>R$ ${orderData.subtotal.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:normal; margin-bottom:5px;">
                  <span>Desconto:</span>
                  <span>- R$ ${orderData.discount.toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>TOTAL:</span>
                <span>R$ ${orderData.total.toFixed(2)}</span>
              </div>
          </div>
          ${pixQrHTML}
          <div style="text-align:center; margin-top:20px; font-size:12px;">
              ${footerMsg}
          </div>
      </div>
  `;
}

function generateClosureReportHTML(salesHistory, shiftSales) {
  const dateStr = new Date().toLocaleString('pt-BR');
  const receiptName = localStorage.getItem('lacasa_receipt_name') || 'LA CASA DE PASTEL';

  const pagamentos = {};
  
  (salesHistory || []).forEach(sale => {
    const pag = (sale.pagamento || 'Dinheiro').toUpperCase();
    if (!pagamentos[pag]) pagamentos[pag] = 0;
    pagamentos[pag] += (sale.total || 0);
  });

  return `
      <div class="receipt">
          <div class="receipt-header">
              <h2 style="font-size:20px;">${receiptName}</h2>
              <p style="font-weight:bold; font-size:16px;">FECHAMENTO DE CAIXA</p>
              <p>${dateStr}</p>
          </div>
          <br/>
          <div style="border-top: 2px dashed black; padding-top: 15px; padding-bottom:15px; text-align:center;">
              <p style="font-size:16px; margin-bottom: 5px;"><strong>Vendas Realizadas:</strong> ${shiftSales.count}</p>
              <p style="font-size:22px; font-weight:bold;">TOTAL: R$ ${(shiftSales.total || 0).toFixed(2)}</p>
          </div>
          <br/>
          <div class="receipt-body" style="border-top: 2px dashed black; padding-top: 15px;">
              <h3 style="text-align:center; font-size: 16px; margin-bottom: 15px;">RESUMO POR PAGAMENTO</h3>
              ${Object.keys(pagamentos).length > 0 
                  ? Object.keys(pagamentos).map(pag => `
                      <div class="receipt-item">
                          <span>FORMA: ${pag}</span>
                          <span>R$ ${pagamentos[pag].toFixed(2)}</span>
                      </div>
                    `).join('')
                  : '<div style="text-align:center;">Nenhuma venda registrada neste turno.</div>'
              }
          </div>
          <div style="text-align:center; margin-top:40px; font-size:12px; border-top: 1px dashed black; padding-top:15px;">
              *** FIM DO RELATÓRIO DO TURNO ***
          </div>
      </div>
  `;
}
