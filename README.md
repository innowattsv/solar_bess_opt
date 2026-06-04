# Innowatt — Calculadora Solar + BESS Residencial

Dashboard de simulación de sistemas fotovoltaicos con almacenamiento para
usuarios residenciales de EDESAL, El Salvador. Implementa el modelo de negocio
de Innowatt bajo el Reglamento Especial de la Ley de Fomento para el Uso de la
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

**Sin dependencias de servidor.** El único recurso externo es Chart.js cargado
desde cdnjs.cloudflare.com. Todo lo demás corre en el navegador del cliente.

---

## Cómo hacer deploy

### Opción 1 — Netlify (recomendada, 5 minutos)

1. Crea cuenta gratuita en https://netlify.com
2. Desde el dashboard, arrastra la carpeta `innowatt-dashboard/` al área de
   "Deploy manually".
3. Netlify asigna una URL automáticamente (ej. `bright-sun-123.netlify.app`).
4. Para dominio propio: Settings → Domain management → Add custom domain.

**Para actualizaciones posteriores:** vuelve a arrastrar la carpeta o configura
deploys automáticos desde GitHub (ver Opción 3).

### Opción 2 — GitHub Pages (gratuita, requiere cuenta GitHub)

1. Crea un repositorio nuevo en GitHub (puede ser privado o público).
2. Sube los tres archivos (`index.html`, `style.css`, `dashboard.js`).
3. Ve a Settings → Pages → Source: selecciona "main branch / root".
4. La URL queda en `https://tu-usuario.github.io/nombre-repo/`.

```bash
# Comandos si tienes Git instalado:
git init
git add .
git commit -m "Innowatt dashboard inicial"
git remote add origin https://github.com/TU_USUARIO/innowatt-dashboard.git
git push -u origin main
```

### Opción 3 — Netlify + GitHub (deploy automático)

La combinación más robusta para actualizar fácilmente:

1. Sube el código a GitHub (siguiendo la Opción 2).
2. En Netlify: "New site" → "Import from Git" → conecta tu repo.
3. Cada vez que hagas `git push`, Netlify redeploya automáticamente en ~30 seg.
4. Puedes asignar un dominio personalizado con HTTPS gratuito (Let's Encrypt).

### Opción 4 — Cloudflare Pages (alternativa a Netlify)

1. Crea cuenta en https://pages.cloudflare.com
2. "Create application" → "Pages" → "Upload assets".
3. Arrastra la carpeta o conecta desde GitHub.
4. Cloudflare Pages incluye CDN global sin costo adicional.

### Opción 5 — Servidor propio o VPS

Si tienes un servidor con Nginx o Apache, simplemente copia los tres archivos
al directorio web (`/var/www/html/` o equivalente). No requiere configuración
especial porque es HTML estático puro.

---

## Por qué NO usar Streamlit o Flask/Django

Streamlit, Flask y Django son frameworks de Python orientados a aplicaciones
con lógica de servidor. Este dashboard no tiene backend: toda la simulación
corre en JavaScript en el navegador del usuario. Añadir un servidor Python
solo agregaría complejidad, costos de hosting y latencia sin ningún beneficio.

Las opciones de arriba (Netlify, GitHub Pages, Cloudflare Pages) son:
- Gratuitas para este tipo de uso
- Con HTTPS automático
- Sin necesidad de gestionar servidores
- Con CDN global incluido

---

## Personalización frecuente

### Cambiar la tarifa por defecto
En `index.html`, busca `value="0.185"` en el input con id `tarifa` y ajusta.

### Cambiar el porcentaje por defecto de Innowatt
En `index.html`, busca `value="80"` en el input con id `share`.

### Agregar tu logo
En `index.html`, reemplaza el emoji ☀ en el `<div class="logo">` por un
`<img>` con tu logo:
```html
<div class="logo">
  <img src="logo.svg" alt="Innowatt" height="28">
</div>
```

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
