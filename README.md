# Innowatt ---- Calculadora Solar + BESS Residencial

Dashboard de simulación de sistemas fotovoltaicos con almacenamiento para
usuarios residenciales en El Salvador. Implementa el Reglamento Especial de la Ley de Fomento para el Uso de la
Energía Renovable (Acuerdo SIGET N.° 072-E-2026).

---

## Estructura del proyecto

```
innowatt-dashboard/
├── index.html       # Estructura HTML y todos los componentes visuales
├── style.css        # Estilos (modo claro y oscuro automático)
├── dashboard.js     # Simulación energética, optimizador y lógica de UI
└── README.md        # Este archivo
```

## Personalización 

### Cambiar la tarifa por defecto
En `index.html`, busca `value="0.185"` en el input con id `tarifa` y ajusta.

### Cambiar el porcentaje de ahorro captado
En `index.html`, busca `value="80"` en el input con id `share`.


### Actualizar el perfil solar
El perfil solar está en `dashboard.js` como `const PERFIL_SOLAR`. Cada fila es
un mes (enero a diciembre), cada columna es una hora (0h a 23h). Los valores
representan la fracción del pico de irradiancia para un sistema de 1 kWp.

### Actualizar el perfil de demanda R2
La constante `const PERFIL_R2` en `dashboard.js` contiene los 24 factores
horarios del perfil residencial R2-110. Puedes reemplazarlos con otro perfil
respetando que la suma de los 24 valores sea exactamente 24.

---

## Base técnica y regulatoria

| Parámetro | Valor | Fuente |
|-----------|-------|--------|
| Perfil solar | Mes × hora, 12×24 | curva_solar_anual.xlsx (El Salvador 2024) |
| Perfil de demanda | R2-110 | factores_forma_2024.xlsx |
| HSP anual | 2,006 kWh/kWp/año | Calculado del archivo solar |
| Reconocimiento reinyección | 50% tarifa vigente | Art. 22 Reglamento LFUER |
| Acumulación de saldos | Máx. 6 períodos FIFO | Art. 24 Reglamento LFUER |
| Límite sin BESS | cons/(720×FC) kW AC | Anexo Técnico I |
| Límite con BESS | gen_mes ≤ cons_mes | Anexo Técnico II |
| Deducción ISR usuario | Sobre costo total | Art. 48 Reglamento LFUER |
| SOC mínimo BESS | 10% (configurable) | Estándar industria |
| SOC máximo BESS | 95% (configurable) | Estándar industria |
| C-rate BESS | 0.5C | Estándar LiFePO4 |
| Degradación solar | 0.5%/año (configurable) | Estándar fabricantes Tier 1 |
| Degradación BESS | 2%/año (fijo internamente) | Estándar LiFePO4 |

---

## Notas legales

Esta calculadora es una herramienta de estimación. Los resultados son
aproximaciones basadas en perfiles promedio y parámetros estándar de la
industria. Los resultados reales pueden variar según las condiciones específicas
de cada instalación, variaciones climáticas, cambios tarifarios y modificaciones
regulatorias posteriores al Acuerdo SIGET N.° 072-E-2026.

Para proyectos reales, consulta siempre con un Proveedor Calificado registrado
ante la SIGET y verifica los parámetros con datos reales del cliente.
