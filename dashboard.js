/* =============================================
   Innowatt Solar Dashboard — dashboard.js
   Lógica de simulación, optimizador y UI
   ============================================= */

'use strict';

// ── Datos del perfil R2-110 (EDESAL) ─────────────────────────────────────────
// Factores horarios normalizados (suma = 24, promedio = 1.0)
// Fuente: factores_forma_2024.xlsx — perfil 1R2-110
const PERFIL_R2 = [
  0.73, 0.72, 0.67, 0.65, 0.65, 0.83, 1.08, 1.05,
  1.03, 0.96, 0.98, 1.05, 1.07, 1.08, 1.08, 1.07,
  1.06, 1.05, 1.21, 1.41, 1.38, 1.29, 1.06, 0.85
];

// ── Perfil solar promedio por mes × hora ─────────────────────────────────────
// Extraído de curva_solar_anual.xlsx (2024, El Salvador)
// Dimensión: [12 meses][24 horas] — valores en kWh/kWp·h (Factor PV normalizado)
const PERFIL_SOLAR = [
  [0,0,0,0,0,0,0.0086,0.1742,0.4398,0.6438,0.7806,0.8311,0.8319,0.7341,0.6266,0.4627,0.2507,0.0361,0,0,0,0,0,0],
  [0,0,0,0,0,0,0.013,0.1846,0.4606,0.6843,0.84,0.9207,0.9123,0.8814,0.7377,0.5625,0.3197,0.0694,0,0,0,0,0,0],
  [0,0,0,0,0,0,0.0284,0.2007,0.4339,0.6547,0.7337,0.7648,0.7782,0.7489,0.6522,0.485,0.3013,0.0851,0.0011,0,0,0,0,0],
  [0,0,0,0,0,0.001,0.0395,0.2087,0.4193,0.586,0.6919,0.7407,0.7382,0.6952,0.5859,0.435,0.2715,0.0729,0.0011,0,0,0,0,0],
  [0,0,0,0,0,0.003,0.0581,0.2253,0.4256,0.5764,0.6492,0.6757,0.6857,0.6517,0.5589,0.4181,0.2698,0.077,0.0011,0,0,0,0,0],
  [0,0,0,0,0,0,0.0398,0.1654,0.336,0.4504,0.5,0.5286,0.5126,0.4838,0.4128,0.3092,0.1842,0.0556,0.0064,0,0,0,0,0],
  [0,0,0,0,0,0,0.0571,0.2046,0.4044,0.563,0.6477,0.6803,0.6776,0.6311,0.5469,0.4288,0.2843,0.0975,0.017,0,0,0,0,0],
  [0,0,0,0,0,0,0.041,0.1755,0.3563,0.4942,0.578,0.6055,0.5926,0.5417,0.4421,0.3107,0.1717,0.0466,0.0046,0,0,0,0,0],
  [0,0,0,0,0,0,0.0445,0.2017,0.3942,0.5326,0.6005,0.6207,0.5915,0.5402,0.4477,0.3199,0.1842,0.0507,0.0008,0,0,0,0,0],
  [0,0,0,0,0,0,0.0382,0.2125,0.4368,0.6098,0.7146,0.7474,0.728,0.6638,0.5519,0.4053,0.2369,0.0512,0,0,0,0,0,0],
  [0,0,0,0,0,0,0.0241,0.1842,0.4244,0.5841,0.6602,0.7066,0.6862,0.6219,0.5168,0.3676,0.1853,0.024,0,0,0,0,0,0],
  [0,0,0,0,0,0,0.0167,0.1781,0.4185,0.5871,0.6786,0.7195,0.7077,0.62,0.5052,0.3401,0.1573,0.0144,0,0,0,0,0,0]
];

const DIAS_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ── Estado global ─────────────────────────────────────────────────────────────
let chartDay = null;
let selectedMonth = -1;
let optResult = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt$ = n => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString('es-SV');
const fmtD = (n, d = 1) => n.toFixed(d);
const g = id => +document.getElementById(id).value || 0;
const getFC = () => ({ R1: 0.66, R2: 0.67, R3: 0.72 })[document.getElementById('cat').value];

// ── Simulación energética anual ───────────────────────────────────────────────
// Simula hora-a-hora los 12 meses del año con el perfil R2-110 y la curva solar
// real de El Salvador. Aplica el esquema de saldos FIFO conforme al Art. 24
// del Reglamento Especial de la Ley de Fomento para el Uso de la Energía Renovable.
function simAnual(params) {
  const {
    pv, bess, cons_mes, tarifa, pr, eff_chg, eff_dis,
    soc_min_pct, soc_max_pct, deg_pv_yr, deg_bess_yr, year
  } = params;

  const pv_factor    = Math.pow(1 - deg_pv_yr, year - 1);
  const bess_cap     = bess * Math.pow(1 - deg_bess_yr, year - 1);
  const bess_kw_max  = bess_cap * 0.5;                       // C-rate 0.5C
  const soc_max_v    = bess_cap * (soc_max_pct / 100);
  const soc_min_v    = bess_cap * (soc_min_pct / 100);
  let soc            = bess_cap * 0.5;

  let autoc = 0, rein = 0, grid = 0, gen = 0;
  let factura_edesal = 0, cred_exp = 0, cred_aplic = 0;
  let cola = [];   // cola FIFO de saldos a favor

  for (let m = 0; m < 12; m++) {
    const sol  = PERFIL_SOLAR[m];
    const dias = DIAS_MES[m];
    let autoc_m = 0, rein_m = 0, grid_m = 0;

    const dem_h_base = PERFIL_R2.map(f => (cons_mes / 30 / 24) * f);

    for (let d = 0; d < dias; d++) {
      for (let h = 0; h < 24; h++) {
        const gh = sol[h] * pv * pr * pv_factor;
        const dh = dem_h_base[h];
        gen += gh;

        // 1. Autoconsumo directo
        const ad = Math.min(gh, dh);
        autoc_m += ad;
        let gx = gh - ad;
        let dr = dh - ad;

        // 2. Cargar batería con excedente solar
        if (gx > 0 && bess_cap > 0 && soc < soc_max_v) {
          const bc = Math.min(gx, (soc_max_v - soc) / eff_chg, bess_kw_max);
          soc += bc * eff_chg;
          gx  -= bc;
        }

        // 3. Descargar batería para cubrir demanda residual
        if (dr > 0 && bess_cap > 0 && soc > soc_min_v) {
          const bd = Math.min(dr, (soc - soc_min_v) * eff_dis, bess_kw_max);
          soc    -= bd / eff_dis;
          dr     -= bd;
          autoc_m += bd;  // energía solar via batería
        }

        rein_m += gx;
        grid_m += dr;
      }
    }

    autoc += autoc_m;
    rein  += rein_m;
    grid  += grid_m;

    // ── Liquidación EDESAL del mes (Arts. 22-24 del Reglamento) ──────────────
    // Art. 22: reconocimiento al 50% de la tarifa vigente
    const credito_nuevo = rein_m * tarifa * 0.5;
    // Art. 23: se aplica como descuento al cargo de energía; no puede superar el cargo
    let cargo = grid_m * tarifa;

    // Art. 24d: aplicar saldos más antiguos primero (FIFO)
    cola.sort((a, b) => b.edad - a.edad);
    for (const s of cola) {
      if (cargo <= 0) break;
      const ap = Math.min(s.monto, cargo);
      s.monto  -= ap;
      cargo    -= ap;
      cred_aplic += ap;
    }
    // Aplicar crédito nuevo del mes
    const nu_ap = Math.min(credito_nuevo, cargo);
    cargo      -= nu_ap;
    cred_aplic += nu_ap;
    if (credito_nuevo - nu_ap > 0.01) {
      cola.push({ monto: credito_nuevo - nu_ap, edad: 0 });
    }

    factura_edesal += cargo;

    // Art. 24a: máximo 6 períodos de acumulación; lo que expire va al PETT
    cola = cola.filter(s => s.monto > 0.01);
    cola.forEach(s => s.edad++);
    const expirados = cola.filter(s => s.edad > 6);
    cred_exp += expirados.reduce((sum, e) => sum + e.monto, 0);
    cola = cola.filter(s => s.edad <= 6);
  }

  return {
    autoc, rein, grid, gen,
    factura_edesal,
    cred_exp,
    cred_aplic,
    autosuf: autoc / (cons_mes * 12) * 100,
    saldo_rem: cola.reduce((s, e) => s + e.monto, 0)
  };
}

// ── Perfil horario para el gráfico ───────────────────────────────────────────
function getDayData(pv, bess, cons_mes, pr, eff_chg, eff_dis, soc_min_pct, soc_max_pct) {
  const sol = selectedMonth >= 0
    ? PERFIL_SOLAR[selectedMonth]
    : (() => {
        const avg = new Array(24).fill(0);
        for (let m = 0; m < 12; m++)
          for (let h = 0; h < 24; h++)
            avg[h] += PERFIL_SOLAR[m][h] * DIAS_MES[m] / 365;
        return avg;
      })();

  const dem_dia  = cons_mes / 30;
  const dem_h    = PERFIL_R2.map(f => parseFloat(((dem_dia / 24) * f).toFixed(4)));
  const gen_h    = sol.map(p => parseFloat((p * pv * pr).toFixed(4)));
  const bess_kw_max = bess * 0.5;
  const soc_max_v   = bess * (soc_max_pct / 100);
  const soc_min_v   = bess * (soc_min_pct / 100);
  let soc = bess * 0.5;
  const soc_log = [];

  for (let h = 0; h < 24; h++) {
    let gx = Math.max(0, gen_h[h] - Math.min(gen_h[h], dem_h[h]));
    let dr = Math.max(0, dem_h[h] - Math.min(gen_h[h], dem_h[h]));
    if (gx > 0 && bess > 0 && soc < soc_max_v) {
      const bc = Math.min(gx, (soc_max_v - soc) / eff_chg, bess_kw_max);
      soc += bc * eff_chg;
    }
    if (dr > 0 && bess > 0 && soc > soc_min_v) {
      const bd = Math.min(dr, (soc - soc_min_v) * eff_dis, bess_kw_max);
      soc -= bd / eff_dis;
    }
    soc_log.push(parseFloat(soc.toFixed(4)));
  }

  return { gen_h, dem_h, soc_log };
}

// ── Inicializar pestañas de meses ─────────────────────────────────────────────
function buildMonthTabs() {
  const container = document.getElementById('month-tabs');
  let html = '<button class="month-tab active" data-m="-1" onclick="selectMonth(-1)">Promedio anual</button>';
  NOMBRES_MES.forEach((m, i) => {
    html += `<button class="month-tab" data-m="${i}" onclick="selectMonth(${i})">${m}</button>`;
  });
  container.innerHTML = html;
}

window.selectMonth = function(m) {
  selectedMonth = m;
  document.querySelectorAll('.month-tab').forEach(t => t.classList.toggle('active', +t.dataset.m === m));
  updateDayChart();
};

// ── Gráfico de perfil horario (Chart.js) ──────────────────────────────────────
function updateDayChart() {
  const pv       = g('pv');
  const bess     = g('bess');
  const cons_mes = g('cons');
  const pr       = g('pr');
  const eff_chg  = g('eff-chg');
  const eff_dis  = g('eff-dis');
  const soc_min  = g('soc-min');
  const soc_max_v = g('soc-max');

  const { gen_h, dem_h, soc_log } = getDayData(pv, bess, cons_mes, pr, eff_chg, eff_dis, soc_min, soc_max_v);
  const hours = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  const isDark    = matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#9090a8' : '#6c757d';

  if (chartDay) {
    chartDay.data.datasets[0].data = gen_h;
    chartDay.data.datasets[1].data = dem_h;
    chartDay.data.datasets[2].data = bess > 0 ? soc_log : new Array(24).fill(null);
    chartDay.update('none');
    return;
  }

  chartDay = new Chart(document.getElementById('chart-day'), {
    type: 'line',
    data: {
      labels: hours,
      datasets: [
        {
          label: 'Generación solar',
          data: gen_h,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.12)',
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          tension: 0.4,
          yAxisID: 'y'
        },
        {
          label: 'Demanda R2-110',
          data: dem_h,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.06)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.3,
          yAxisID: 'y'
        },
        {
          label: 'SOC batería',
          data: bess > 0 ? soc_log : new Array(24).fill(null),
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34,197,94,0.10)',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: true,
          tension: 0.4,
          yAxisID: 'y2'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: isDark ? '#1a1a24' : '#fff',
          borderColor: gridColor,
          borderWidth: 1,
          titleColor: textColor,
          bodyColor: isDark ? '#c2c0b6' : '#3d3d3a',
          padding: 10,
          callbacks: {
            label: ctx => {
              if (ctx.parsed.y === null) return null;
              const suffix = ctx.datasetIndex === 2 ? ' kWh' : ' kW';
              return ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}${suffix}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            autoSkip: false,
            maxRotation: 0,
            callback: (val, i) => i % 4 === 0 ? hours[i] : ''
          }
        },
        y: {
          position: 'left',
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: v => v.toFixed(1) + ' kW'
          },
          title: { display: true, text: 'kW', color: textColor, font: { size: 11 } }
        },
        y2: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: {
            color: '#22c55e',
            font: { size: 11 },
            callback: v => v.toFixed(1) + ' kWh'
          },
          title: { display: bess > 0, text: 'kWh batería', color: '#22c55e', font: { size: 11 } }
        }
      }
    }
  });
}

// ── Optimizador ───────────────────────────────────────────────────────────────
// Objetivo: maximizar la cobertura de la demanda del cliente.
// Restricción: payback de Innowatt ≤ pb_max años y cumplimiento regulatorio.
// Desempate: si dos sistemas tienen cobertura similar (< 0.5%), se prefiere
// el de menor payback (mejor retorno para Innowatt).
window.runOptimizer = function() {
  const cons_mes = g('cons'), tarifa = g('tarifa');
  const cpv = g('cpv'), cbess = g('cbess');
  const share = g('share') / 100, pb_max = g('pb-max');
  const pr = g('pr'), eff_chg = g('eff-chg'), eff_dis = g('eff-dis');
  const soc_min = g('soc-min'), soc_max_v = g('soc-max');
  const deg_pv = g('deg-pv') / 100;
  const FC = getFC();
  const lim_sin_bess = cons_mes / (720 * FC);

  const pvs = [], besses = [];
  for (let p = 0.2; p <= 7.0; p = Math.round((p + 0.5) * 10) / 10) pvs.push(p);
  for (let b = 0; b <= 15; b += 0.5) besses.push(b);

  let mejor = null, total_eval = 0, total_pasan = 0;

  for (const pv of pvs) {
    for (const bess of besses) {
      const gen_mes = pv * 5.48 * 30 * pr;
      const legal = (bess === 0 && pv <= lim_sin_bess + 0.01) ||
                    (bess > 0  && gen_mes <= cons_mes + 1);
      if (!legal) continue;
      total_eval++;

      const res = simAnual({
        pv, bess, cons_mes, tarifa, pr, eff_chg, eff_dis,
        soc_min_pct: soc_min, soc_max_pct: soc_max_v,
        deg_pv_yr: deg_pv, deg_bess_yr: 0.02, year: 1
      });

      const ahorro = cons_mes * 12 * tarifa - res.factura_edesal;
      const cuota  = ahorro * share;
      const capex  = pv * 1000 * cpv + bess * cbess;

      let cum = -capex, pb = null;
      for (let y = 1; y <= 20; y++) {
        cum += cuota * Math.pow(1 - deg_pv, y - 1);
        if (cum >= 0 && !pb) { pb = y; break; }
      }
      if (!pb || pb > pb_max) continue;
      total_pasan++;

      // Seleccionar el candidato con mayor autosuficiencia.
      // Si la diferencia es menor a 0.5%, desempatar por menor payback.
      if (!mejor ||
          res.autosuf > mejor.autosuf + 0.5 ||
          (Math.abs(res.autosuf - mejor.autosuf) <= 0.5 && pb < mejor.pb)) {
        mejor = { pv, bess, autosuf: res.autosuf, pb, capex, ahorro, cuota };
      }
    }
  }

  if (!mejor) {
    alert(
      `No existe ningún sistema que cumpla payback ≤ ${pb_max} años.\n\n` +
      `Sugerencias:\n` +
      `• Aumenta el payback máximo\n` +
      `• Sube el % del ahorro para Innowatt\n` +
      `• Verifica los costos de equipos`
    );
    return;
  }

  let tir = '>50';
  for (let r = -0.05; r <= 1.0; r += 0.005) {
    let v = -mejor.capex;
    for (let y = 1; y <= 20; y++)
      v += (mejor.cuota * Math.pow(1 - deg_pv, y - 1)) / Math.pow(1 + r, y);
    if (v <= 0) { tir = r > 0 ? (r * 100).toFixed(1) : '<0'; break; }
  }

  optResult = { ...mejor, tir };

  document.getElementById('opt-result').classList.add('visible');
  document.getElementById('opt-vals').innerHTML = `
    <div class="opt-cell"><div class="ov">${mejor.pv.toFixed(1)} kW</div><div class="ol">Solar</div></div>
    <div class="opt-cell"><div class="ov">${mejor.bess.toFixed(1)} kWh</div><div class="ol">BESS</div></div>
    <div class="opt-cell"><div class="ov">${mejor.autosuf.toFixed(0)}%</div><div class="ol">Autosuficiencia</div></div>
    <div class="opt-cell"><div class="ov">${fmt$(mejor.capex)}</div><div class="ol">CAPEX total</div></div>
    <div class="opt-cell"><div class="ov">${mejor.pb} años</div><div class="ol">Payback</div></div>
    <div class="opt-cell"><div class="ov">${tir}%</div><div class="ol">TIR estimada</div></div>
  `;
  document.getElementById('opt-detail').textContent =
    `${total_pasan} sistemas dentro del plazo de ${pb_max} años · ` +
    `${total_eval} combinaciones legales evaluadas`;
};

window.applyOptimal = function() {
  if (!optResult) return;
  document.getElementById('pv').value   = optResult.pv;
  document.getElementById('bess').value = optResult.bess;
  compute();
};

// ── Cómputo principal ─────────────────────────────────────────────────────────
function compute() {
  const cons_mes  = g('cons');
  const tarifa    = g('tarifa');
  const pv        = g('pv');
  const bess      = g('bess');
  const cpv       = g('cpv');
  const cbess_v   = g('cbess');
  const share     = g('share') / 100;
  const isr       = g('isr') / 100;
  const wacc      = g('wacc') / 100;
  const pr        = g('pr');
  const deg_pv    = g('deg-pv') / 100;
  const eff_chg   = g('eff-chg');
  const eff_dis   = g('eff-dis');
  const soc_min   = g('soc-min');
  const soc_max_v = g('soc-max');
  const FC        = getFC();

  // ── Verificación legal (Anexo I / II del Reglamento) ─────────────────────
  const lim_pot = cons_mes / (720 * FC);
  const gen_mes = pv * 5.48 * 30 * pr;
  const notice  = document.getElementById('legal-notice');

  if (bess > 0) {
    notice.innerHTML = gen_mes <= cons_mes + 1
      ? `<div class="callout">✓ Cumple Anexo II (con BESS). Generación ~${Math.round(gen_mes)} kWh/mes ≤ consumo ${cons_mes} kWh/mes.</div>`
      : `<div class="warn-box">⚠ Generación (~${Math.round(gen_mes)} kWh/mes) excede el consumo del cliente. El Anexo II no permite esto. Reduce la capacidad solar.</div>`;
  } else {
    notice.innerHTML = pv <= lim_pot + 0.01
      ? `<div class="callout">✓ Cumple Anexo I (sin BESS). ${fmtD(pv, 1)} kW ≤ ${fmtD(lim_pot, 2)} kW máximo para ${cons_mes} kWh/mes.</div>`
      : `<div class="warn-box">⚠ Sin BESS el límite del Anexo I es ${fmtD(lim_pot, 2)} kW AC. Agrega BESS para permitir este tamaño (Anexo II).</div>`;
  }

  // ── Año 1 ─────────────────────────────────────────────────────────────────
  const params1 = { pv, bess, cons_mes, tarifa, pr, eff_chg, eff_dis, soc_min_pct: soc_min, soc_max_pct: soc_max_v, deg_pv_yr: deg_pv, deg_bess_yr: 0.02, year: 1 };
  const res     = simAnual(params1);
  const cons_anual         = cons_mes * 12;
  const factura_antes      = cons_anual * tarifa;
  const factura_antes_mes  = factura_antes / 12;
  const factura_edesal_mes = res.factura_edesal / 12;
  const ahorro_anual       = factura_antes - res.factura_edesal;
  const cuota_inno_mes     = ahorro_anual * share / 12;
  const total_despues_mes  = factura_edesal_mes + cuota_inno_mes;
  const ahorro_cliente_mes = factura_antes_mes - total_despues_mes;
  const ahorro_pct         = factura_antes_mes > 0 ? ahorro_cliente_mes / factura_antes_mes * 100 : 0;

  // ── Comparativo de pagos ──────────────────────────────────────────────────
  document.getElementById('pay-before').textContent    = fmt$(factura_antes_mes);
  document.getElementById('kwh-before').textContent    = cons_mes + ' kWh';
  document.getElementById('tar-before').textContent    = '$' + tarifa.toFixed(3) + '/kWh';
  document.getElementById('tot-before').textContent    = fmt$(factura_antes_mes) + '/mes';
  document.getElementById('pay-after').textContent     = fmt$(total_despues_mes);
  document.getElementById('kwh-after').textContent     = Math.round(res.grid / 12) + ' kWh';
  document.getElementById('edesal-after').textContent  = fmt$(factura_edesal_mes) + '/mes';
  document.getElementById('innowatt-after').textContent = fmt$(cuota_inno_mes) + '/mes';
  document.getElementById('tot-after').textContent     = fmt$(total_despues_mes) + '/mes';
  document.getElementById('pay-savings').textContent   = fmt$(ahorro_cliente_mes);
  document.getElementById('sav-month').textContent     = fmt$(ahorro_cliente_mes) + '/mes';
  document.getElementById('sav-year').textContent      = fmt$(ahorro_cliente_mes * 12) + '/año';
  document.getElementById('sav-pct').textContent       = ahorro_pct.toFixed(0) + '%';

  // Barras comparativas
  const mv = factura_antes_mes || 1;
  const pe = factura_edesal_mes / mv * 100;
  const pi = cuota_inno_mes / mv * 100;
  const ps = ahorro_cliente_mes / mv * 100;
  const segs = [['b-edesal', pe, factura_edesal_mes], ['b-innowatt', pi, cuota_inno_mes], ['b-saving', ps, ahorro_cliente_mes]];
  segs.forEach(([id, pct, val]) => {
    const el   = document.getElementById(id);
    el.style.width   = Math.max(0, pct).toFixed(1) + '%';
    el.textContent   = pct > 12 ? fmt$(val) : '';
  });
  document.getElementById('bv-before').textContent = fmt$(factura_antes_mes) + '/mes';
  document.getElementById('bv-after').textContent  = fmt$(total_despues_mes) + ' pago + ' + fmt$(ahorro_cliente_mes) + ' ahorro';

  // Nota reinyección (Art. 24)
  const credito_total = res.rein * tarifa * 0.5;
  const reinNote = document.getElementById('rein-note');
  if (res.cred_exp > 5) {
    reinNote.innerHTML = `⚠ Art. 24: ${fmt$(res.cred_exp)}/año de crédito por reinyección expira sin aplicarse y pasa al ajuste del PETT. El cliente no lo recupera. Considera aumentar el BESS.`;
  } else {
    reinNote.innerHTML = `Art. 24: Crédito por reinyección ${fmt$(credito_total)}/año — aplicado dentro del plazo de 6 meses. Saldo remanente para el siguiente año: ${fmt$(res.saldo_rem)}.`;
  }

  // ── Flujo a 20 años ───────────────────────────────────────────────────────
  const capex_pv   = pv * 1000 * cpv;
  const capex_bess = bess * cbess_v;
  const capex      = capex_pv + capex_bess;
  let cum = -capex, vpn = -capex, payback = null;
  const detalles = [];

  for (let y = 1; y <= 20; y++) {
    const ry  = simAnual({ ...params1, year: y });
    const ah  = factura_antes - ry.factura_edesal;
    const ing = ah * share;
    cum += ing;
    vpn += ing / Math.pow(1 + wacc, y);
    if (!payback && cum >= 0) payback = y;
    detalles.push({ y, ahorro_y: ah, ing, cli: ah - ing, cum, fe: ry.factura_edesal });
  }

  // TIR
  let tir = '>50';
  for (let r = -0.05; r <= 1.0; r += 0.005) {
    let v = -capex;
    for (let y = 1; y <= 20; y++)
      v += (ahorro_anual * Math.pow(1 - deg_pv, y - 1) * share) / Math.pow(1 + r, y);
    if (v <= 0) { tir = r > 0 ? (r * 100).toFixed(1) : '<0'; break; }
  }
  const total20 = detalles.reduce((s, d) => s + d.ing, 0);
  const roi20   = capex > 0 ? (total20 - capex) / capex * 100 : 0;

  // ── Métricas Innowatt ─────────────────────────────────────────────────────
  document.getElementById('m-key').innerHTML = `
    <div class="metric hero">
      <div class="m-label">Payback Innowatt</div>
      <div class="m-value">${payback ? payback + ' años' : '>20a'}</div>
      <div class="m-sub">CAPEX ${fmt$(capex)}</div>
    </div>
    <div class="metric ok">
      <div class="m-label">TIR del proyecto</div>
      <div class="m-value">${tir}%</div>
      <div class="m-sub">vs WACC ${(wacc * 100).toFixed(0)}%</div>
    </div>
    <div class="metric ok">
      <div class="m-label">VPN (${(wacc * 100).toFixed(0)}%)</div>
      <div class="m-value">${fmt$(vpn)}</div>
      <div class="m-sub">Valor presente 20 años</div>
    </div>
    <div class="metric">
      <div class="m-label">ROI 20 años</div>
      <div class="m-value">${roi20.toFixed(0)}%</div>
      <div class="m-sub">${fmt$(total20)} sobre ${fmt$(capex)}</div>
    </div>
  `;
  document.getElementById('m-sec').innerHTML = `
    <div class="metric">
      <div class="m-label">Ingreso Innowatt</div>
      <div class="m-value">${fmt$(cuota_inno_mes)}/mes</div>
      <div class="m-sub">${(share * 100).toFixed(0)}% del ahorro · ${fmt$(ahorro_anual * share)}/año</div>
    </div>
    <div class="metric">
      <div class="m-label">Ahorro cliente</div>
      <div class="m-value">${fmt$(ahorro_cliente_mes)}/mes</div>
      <div class="m-sub">+ ${fmt$(capex * isr)} deducción ISR año 1</div>
    </div>
    <div class="metric">
      <div class="m-label">Autosuficiencia</div>
      <div class="m-value">${res.autosuf.toFixed(0)}%</div>
      <div class="m-sub">${Math.round(res.autoc).toLocaleString()}/${cons_anual.toLocaleString()} kWh</div>
    </div>
  `;

  // ── Gráfico del día ────────────────────────────────────────────────────────
  updateDayChart();

  // ── Cobertura energética ──────────────────────────────────────────────────
  const cob_a = res.autoc / cons_anual * 100;
  const cob_g = res.grid  / cons_anual * 100;
  const rein_pct = res.gen > 0 ? res.rein / res.gen * 100 : 0;
  document.getElementById('cobertura').innerHTML = `
    <p style="font-size:12px;color:var(--text-secondary);margin:0 0 4px">
      Consumo: ${cons_anual.toLocaleString()} kWh/año &nbsp;·&nbsp; Generación: ${Math.round(res.gen).toLocaleString()} kWh/año
    </p>
    <div class="cobertura-bar">
      <div style="width:${cob_a.toFixed(0)}%;background:#22c55e">${cob_a.toFixed(0)}% solar</div>
      <div style="width:${cob_g.toFixed(0)}%;background:#94a3b8">${cob_g.toFixed(0)}% red</div>
    </div>
    <table style="margin-top:12px">
      <tr><th>Concepto</th><th style="text-align:right">kWh/año</th><th style="text-align:right">Valor</th></tr>
      <tr><td>Autoconsumo (directo + BESS)</td><td style="text-align:right">${Math.round(res.autoc).toLocaleString()}</td><td style="text-align:right;color:var(--success-text)">${fmt$(res.autoc * tarifa)}</td></tr>
      <tr><td>Reinyección a red (50% Art. 22)</td><td style="text-align:right">${Math.round(res.rein).toLocaleString()} (${rein_pct.toFixed(0)}% gen)</td><td style="text-align:right;color:var(--blue-text)">${fmt$(credito_total)} crédito</td></tr>
      <tr><td>Importación desde red</td><td style="text-align:right">${Math.round(res.grid).toLocaleString()}</td><td style="text-align:right">${fmt$(res.grid * tarifa)}</td></tr>
      <tr><td style="color:var(--warn-text)">Crédito expirado Art. 24</td><td style="text-align:right">—</td><td style="text-align:right;color:var(--warn-text)">${fmt$(res.cred_exp)}</td></tr>
      <tr class="row-highlight"><td>Factura EDESAL antes → después</td><td style="text-align:right">—</td><td style="text-align:right">${fmt$(factura_antes)} → ${fmt$(res.factura_edesal)}/año</td></tr>
    </table>
  `;

  // ── Tabla año por año ─────────────────────────────────────────────────────
  let html = `<tr>
    <th>Año</th>
    <th style="text-align:right">Factura antes</th>
    <th style="text-align:right">Factura después</th>
    <th style="text-align:right">Cuota Innowatt</th>
    <th style="text-align:right">Total cliente</th>
    <th style="text-align:right">Ahorro cliente</th>
    <th style="text-align:right">Flujo Innowatt</th>
  </tr>`;
  detalles.forEach(d => {
    const isPayback   = d.cum >= 0 && (detalles[d.y - 2]?.cum < 0 || d.y === 1 && -capex >= 0);
    const isMilestone = d.y % 5 === 0;
    const cls = isPayback ? 'row-payback' : (isMilestone ? 'row-highlight' : '');
    const total = d.fe + d.ing;
    const sav   = factura_antes - total;
    html += `<tr class="${cls}">
      <td>${d.y}</td>
      <td style="text-align:right">${fmt$(factura_antes)}</td>
      <td style="text-align:right">${fmt$(d.fe)}</td>
      <td style="text-align:right">${fmt$(d.ing)}</td>
      <td style="text-align:right">${fmt$(total)}</td>
      <td style="text-align:right;color:var(--success-text)">${fmt$(sav)}</td>
      <td style="text-align:right">${fmt$(d.cum)}</td>
    </tr>`;
  });
  document.getElementById('tbl').innerHTML = html;
}

// ── Registro de listeners y arranque ─────────────────────────────────────────
const INPUT_IDS = [
  'cons','tarifa','pv','bess','cpv','cbess','share','isr',
  'wacc','pr','deg-pv','eff-chg','eff-dis','soc-min','soc-max'
];

document.addEventListener('DOMContentLoaded', () => {
  buildMonthTabs();
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', compute);
      el.addEventListener('change', compute);
    }
  });
  document.getElementById('cat').addEventListener('change', compute);
  compute();
});

// pb-max-txt sync (se ejecuta después del DOMContentLoaded original)
document.addEventListener('DOMContentLoaded', () => {
  const pbEl = document.getElementById('pb-max');
  const pbTxt = document.getElementById('pb-max-txt');
  if (pbEl && pbTxt) {
    pbEl.addEventListener('input', () => { pbTxt.textContent = pbEl.value; });
  }
});
