// ============================================
// COOPERADORA HSJB - Frontend Kiosco
// ============================================

let turnoActual = null;
let carrito = [];        // Items del turno (todos los escaneos)
let productoSeleccionado = null;

// -------- UTILIDADES --------
const $ = (id) => document.getElementById(id);

function generarTurnoId() {
  const d = new Date();
  return `T-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatoMoneda(n) {
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function api(action, params = {}) {
  const url = new URL(CONFIG.API_URL);
  url.searchParams.set('action', action);
  Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}

function mostrarModal(titulo, mensaje, onConfirm) {
  $('modalTitulo').textContent = titulo;
  $('modalMensaje').textContent = mensaje;
  $('modal').classList.remove('hidden');
  $('btnConfirmar').onclick = () => {
    $('modal').classList.add('hidden');
    if (onConfirm) onConfirm();
  };
  $('btnCancelar').onclick = () => $('modal').classList.add('hidden');
}

// -------- INICIALIZACIÓN --------
document.addEventListener('DOMContentLoaded', () => {
  // Iniciar turno automáticamente si no existe
  if (!localStorage.getItem('turnoActual')) {
    localStorage.setItem('turnoActual', generarTurnoId());
    localStorage.setItem('horaInicioTurno', new Date().toISOString());
  }
  turnoActual = localStorage.getItem('turnoActual');
  $('estadoTurno').textContent = 'Turno: ' + turnoActual;

  // Recuperar carrito
  const carritoGuardado = localStorage.getItem('carrito_' + turnoActual);
  if (carritoGuardado) carrito = JSON.parse(carritoGuardado);

  renderCarrito();
  renderRegistro();

  // Tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      $('tab-' + t.dataset.tab).classList.add('active');
      if (t.dataset.tab === 'productos') cargarProductos();
      if (t.dataset.tab === 'registro') renderRegistro();
    });
  });

  // Escanear código
  $('inputCodigo').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      buscarProducto($('inputCodigo').value.trim());
    }
  });
  $('btnBuscar').addEventListener('click', () => buscarProducto($('inputCodigo').value.trim()));

  // Agregar al carrito
  $('btnAgregar').addEventListener('click', agregarAlCarrito);

  // Form producto
  $('formProducto').addEventListener('submit', guardarProducto);

  // Refrescar productos
  $('btnRefrescar').addEventListener('click', cargarProductos);

  // Cerrar turno
  $('btnCerrarTurno').addEventListener('click', () => {
    if (carrito.length === 0) {
      alert('No hay ventas registradas en este turno.');
      return;
    }
    mostrarModal(
      '🔒 Cerrar turno',
      '¿Desea confirmar el cierre del turno? Se generará el resumen de ventas.',
      confirmarCierreTurno
    );
  });
});

// -------- PRODUCTOS --------
async function buscarProducto(codigo) {
  if (!codigo) return;
  const r = await api('buscarProducto', { codigo });
  if (!r.ok) {
    alert('❌ ' + r.error);
    $('inputCodigo').value = '';
    $('inputCodigo').focus();
    return;
  }
  productoSeleccionado = r.producto;
  $('prodNombre').textContent = r.producto.nombre;
  $('prodPrecio').textContent = formatoMoneda(r.producto.precio);
  $('prodStock').textContent = r.producto.stock;
  $('prodCantidad').value = 1;
  $('productoActual').classList.remove('hidden');
  $('inputCodigo').value = '';
  $('prodCantidad').focus();
}

async function guardarProducto(e) {
  e.preventDefault();
  const params = {
    codigo: $('newCodigo').value.trim(),
    nombre: $('newNombre').value.trim(),
    precio: $('newPrecio').value,
    stock: $('newStock').value || 0
  };
  const r = await api('addProducto', params);
  if (r.ok) {
    alert('✅ Producto guardado');
    $('formProducto').reset();
    cargarProductos();
  } else {
    alert('❌ ' + r.error);
  }
}

async function cargarProductos() {
  const r = await api('getProductos');
  if (!r.ok) return;
  const tbody = document.querySelector('#tablaProductos tbody');
  tbody.innerHTML = r.productos.map(p => `
    <tr>
      <td>${p.codigo}</td>
      <td>${p.nombre}</td>
      <td>$${formatoMoneda(p.precio)}</td>
      <td>${p.stock}</td>
    </tr>
  `).join('');
}

// -------- CARRITO --------
function agregarAlCarrito() {
  if (!productoSeleccionado) return;
  const cantidad = parseInt($('prodCantidad').value) || 1;
  const item = {
    codigo: productoSeleccionado.codigo,
    producto: productoSeleccionado.nombre,
    precio: productoSeleccionado.precio,
    cantidad: cantidad,
    total: productoSeleccionado.precio * cantidad,
    hora: new Date().toLocaleTimeString('es-AR')
  };

  // Registrar en backend
  api('registrarVenta', {
    turno: turnoActual,
    codigo: item.codigo,
    producto: item.producto,
    precio: item.precio,
    cantidad: item.cantidad,
    total: item.total,
    vendedor: ''
  });

  carrito.push(item);
  localStorage.setItem('carrito_' + turnoActual, JSON.stringify(carrito));

  $('productoActual').classList.add('hidden');
  productoSeleccionado = null;
  $('inputCodigo').focus();

  renderCarrito();
  renderRegistro();
}

function renderCarrito() {
  const tbody = document.querySelector('#tablaCarrito tbody');
  tbody.innerHTML = carrito.map((item, i) => `
    <tr>
      <td>${item.codigo}</td>
      <td>${item.producto}</td>
      <td>$${formatoMoneda(item.precio)}</td>
      <td>${item.cantidad}</td>
      <td>$${formatoMoneda(item.total)}</td>
      <td><button onclick="eliminarItem(${i})" style="color:red;border:none;background:none;cursor:pointer;font-size:1.2rem;">✖</button></td>
    </tr>
  `).join('');
  $('totalTurno').textContent = formatoMoneda(totalCarrito());
  $('totalRegistro').textContent = formatoMoneda(totalCarrito());
}

function eliminarItem(i) {
  if (!confirm('¿Eliminar este item del carrito? (No se borrará del registro del backend)')) return;
  carrito.splice(i, 1);
  localStorage.setItem('carrito_' + turnoActual, JSON.stringify(carrito));
  renderCarrito();
  renderRegistro();
}

function totalCarrito() {
  return carrito.reduce((s, i) => s + i.total, 0);
}

// -------- REGISTRO --------
function renderRegistro() {
  const tbody = document.querySelector('#tablaRegistro tbody');
  tbody.innerHTML = carrito.map(item => `
    <tr>
      <td>${item.hora}</td>
      <td>${item.producto}</td>
      <td>${item.cantidad}</td>
      <td>$${formatoMoneda(item.total)}</td>
    </tr>
  `).join('');
  $('totalRegistro').textContent = formatoMoneda(totalCarrito());
}

// -------- CIERRE DE TURNO --------
async function confirmarCierreTurno() {
  const total = totalCarrito();
  const cantidadItems = carrito.reduce((s, i) => s + i.cantidad, 0);

  // Agrupar por producto para el resumen
  const resumenMap = {};
  carrito.forEach(i => {
    if (!resumenMap[i.codigo]) {
      resumenMap[i.codigo] = { producto: i.producto, cantidad: 0, total: 0 };
    }
    resumenMap[i.codigo].cantidad += i.cantidad;
    resumenMap[i.codigo].total += i.total;
  });

  const resumenTexto = Object.values(resumenMap)
    .map(r => `${r.producto} x${r.cantidad} = $${formatoMoneda(r.total)}`)
    .join(' | ');

  // Guardar cierre en backend
  await api('cerrarTurno', {
    turno: turnoActual,
    horaInicio: localStorage.getItem('horaInicioTurno'),
    totalVentas: total,
    cantidadItems: cantidadItems,
    resumen: resumenTexto
  });

  // Mostrar resumen
  mostrarResumen(total, cantidadItems, resumenMap);
}

function mostrarResumen(total, cantidadItems, resumenMap) {
  const filas = Object.entries(resumenMap).map(([cod, r]) => `
    <tr>
      <td>${cod}</td>
      <td>${r.producto}</td>
      <td>${r.cantidad}</td>
      <td>$${formatoMoneda(r.total)}</td>
    </tr>
  `).join('');

  $('resumenContenido').innerHTML = `
    <p><strong>Institución:</strong> ${CONFIG.NOMBRE_INSTITUCION}</p>
    <p><strong>Turno:</strong> ${turnoActual}</p>
    <p><strong>Fecha cierre:</strong> ${new Date().toLocaleString('es-AR')}</p>
    <hr style="margin:15px 0;">
    <table>
      <thead><tr><th>Código</th><th>Producto</th><th>Cant.</th><th>Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="total-box">
      <strong>TOTAL: $${formatoMoneda(total)} (${cantidadItems} items)</strong>
    </div>
  `;
  $('modalResumen').classList.remove('hidden');

  $('btnExportarPDF').onclick = () => exportarPDF(total, cantidadItems, resumenMap);
  $('btnNuevoTurno').onclick = iniciarNuevoTurno;
}

function exportarPDF(total, cantidadItems, resumenMap) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text(CONFIG.NOMBRE_INSTITUCION, 105, y, { align: 'center' });
  y += 10;
  doc.setFontSize(13);
  doc.text('Resumen de Turno - Kiosco', 105, y, { align: 'center' });
  y += 12;

  doc.setFontSize(10);
  doc.text(`Turno: ${turnoActual}`, 14, y); y += 6;
  doc.text(`Fecha cierre: ${new Date().toLocaleString('es-AR')}`, 14, y); y += 10;

  // Encabezado tabla
  doc.setFontSize(11);
  doc.setFillColor(30, 64, 175);
  doc.setTextColor(255, 255, 255);
  doc.rect(14, y, 182, 8, 'F');
  doc.text('Código', 18, y + 6);
  doc.text('Producto', 50, y + 6);
  doc.text('Cant.', 130, y + 6);
  doc.text('Total', 160, y + 6);
  y += 8;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  Object.entries(resumenMap).forEach(([cod, r]) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(String(cod), 18, y + 6);
    doc.text(String(r.producto).substring(0, 40), 50, y + 6);
    doc.text(String(r.cantidad), 130, y + 6);
    doc.text('$' + formatoMoneda(r.total), 160, y + 6);
    y += 8;
  });

  y += 5;
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text(`TOTAL: $${formatoMoneda(total)} (${cantidadItems} items)`, 14, y);

  doc.save(`Resumen_Turno_${turnoActual}.pdf`);
}

function iniciarNuevoTurno() {
  // Limpiar datos del turno
  localStorage.removeItem('carrito_' + turnoActual);
  carrito = [];
  const nuevoTurno = generarTurnoId();
  localStorage.setItem('turnoActual', nuevoTurno);
  localStorage.setItem('horaInicioTurno', new Date().toISOString());
  turnoActual = nuevoTurno;
  $('estadoTurno').textContent = 'Turno: ' + turnoActual;

  $('modalResumen').classList.add('hidden');
  $('productoActual').classList.add('hidden');
  renderCarrito();
  renderRegistro();
  $('inputCodigo').focus();
  alert('✅ Nuevo turno iniciado: ' + turnoActual);
}
