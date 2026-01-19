# 🥩 Brasargent Rodizio - Sitio Web Minimalista

## ✅ PROYECTO COMPLETADO

He creado un sitio web **minimalista y conversion-focused** inspirado en Gino's Pizza, optimizado para conversión máxima.

---

## 📁 ESTRUCTURA DE ARCHIVOS CREADOS

```
src/
├── layouts/
│   └── Minimal.astro ✅ Layout sin sidebar, solo estructura básica
├── components/
│   ├── NavbarSimple.astro ✅ Navbar fija minimalista
│   ├── HeroSimple.astro ✅ Hero con imagen full-screen + CTA WhatsApp
│   ├── MeatGrid.astro ✅ Grid de 6 cortes estilo cards
│   ├── ContactSimple.astro ✅ Sección de contacto + mapa
│   ├── FooterSimple.astro ✅ Footer minimalista
│   └── FloatCTA.astro ✅ Botón flotante WhatsApp (fixed)
└── pages/
    └── index.astro ✅ Página principal que ensambla todo
```

---

## 🎯 CARACTERÍSTICAS IMPLEMENTADAS

### 1. **Hero Section**

- ✅ Imagen full-bleed con overlay oscuro
- ✅ Título impactante con gradiente
- ✅ Precio destacado (Bs. 120)
- ✅ 2 CTAs: WhatsApp (principal) y Ver Menú (secundario)
- ✅ Información de ubicación y horarios
- ✅ Indicador de scroll animado

### 2. **Grid de Cortes**

- ✅ 6 cortes de carne con cards minimalistas
- ✅ Imágenes con hover effect (scale)
- ✅ Badge de "Más Pedido" en destacados
- ✅ Botón de reserva en cada card
- ✅ Responsive: 1 col (móvil), 2 cols (tablet), 3 cols (desktop)
- ✅ CTA final de sección

### 3. **Navegación**

- ✅ Navbar fija con scroll suave
- ✅ Logo + Enlaces + CTA de reserva
- ✅ Menú móvil responsive
- ✅ Smooth scroll a secciones (#inicio, #menu, #contacto)

### 4. **Botón Flotante WhatsApp**

- ✅ Fixed en esquina inferior derecha
- ✅ Efecto de pulso animado
- ✅ Tooltip en hover
- ✅ Enlace directo a WhatsApp

### 5. **Sección de Contacto**

- ✅ Información de dirección, teléfono y horarios
- ✅ Mapa de Google Maps integrado
- ✅ CTA de reserva
- ✅ Diseño en grid responsive

### 6. **Footer**

- ✅ Información de la empresa
- ✅ Enlaces rápidos
- ✅ Datos de contacto
- ✅ Redes sociales (Facebook, Instagram)

---

## 📱 RESPONSIVE DESIGN

- ✅ **Mobile-first**: Todo optimizado para móvil primero
- ✅ **Touch-friendly**: Botones grandes y espaciado generoso
- ✅ **Grid adaptativo**:
  - Móvil: 1 columna
  - Tablet: 2 columnas
  - Desktop: 3 columnas

---

## 🎨 PALETA DE COLORES

```css
--color-carbon: #1a1a1a /* Negro carbón */ --color-terracotta: #9e2a2b
  /* Rojo terracota */ --color-wood: #d4a574 /* Madera */ --color-cream: #fffaf0
  /* Crema */ --color-gold: #d4af37 /* Dorado */;
```

---

## 📞 INTEGRACIÓN WHATSAPP

**Número configurado**: 59178555886

Todos los botones de reserva abren WhatsApp con mensaje pre-configurado:

- "Hola! Me gustaría hacer una reserva en Brasargent Rodizio"

---

## 🔧 PRÓXIMOS PASOS (PERSONALIZACIÓN)

### 1. **Reemplazar Imágenes**

Actualiza estas imágenes en la carpeta `public/`:

- `/hero-bg.jpg` → Imagen de parrilla para el hero
- `/meat-cuts.jpg` → Imágenes de cada corte (6 imágenes diferentes)

### 2. **Actualizar Coordenadas del Mapa**

En `ContactSimple.astro`, línea ~75:

```html
<iframe src="AQUÍ_TU_URL_DE_GOOGLE_MAPS" ...></iframe>
```

### 3. **Personalizar Cortes**

En `MeatGrid.astro`, líneas 6-53:

- Actualiza nombres, descripciones e imágenes de cada corte
- Marca los destacados con `destacado: true`

### 4. **Redes Sociales**

En `FooterSimple.astro`, actualiza los enlaces:

- Facebook: `https://facebook.com/brasargent`
- Instagram: `https://instagram.com/brasargent`

---

## 🚀 CÓMO VER EL SITIO

1. El servidor ya está corriendo en: **http://localhost:4321**
2. Abre tu navegador y visita esa URL
3. Verás el sitio completo funcionando

---

## ✨ OPTIMIZACIONES IMPLEMENTADAS

- ✅ **Smooth scroll** en toda la navegación
- ✅ **Lazy loading** de imágenes
- ✅ **Hover effects** sutiles y profesionales
- ✅ **Transiciones suaves** (300ms)
- ✅ **SEO optimizado** (meta tags, títulos, descripciones)
- ✅ **Accesibilidad** (aria-labels, alt texts)

---

## 🎯 CONVERSIÓN MÁXIMA

Cada elemento está diseñado para llevar al usuario a reservar:

1. **Hero**: 2 CTAs prominentes
2. **Navbar**: Botón de reserva siempre visible
3. **Cards de cortes**: Botón de reserva en cada una
4. **Sección de menú**: CTA final grande
5. **Contacto**: Botón de reserva destacado
6. **Botón flotante**: Siempre accesible en toda la página

---

## 📊 MÉTRICAS DE DISEÑO

- **Tiempo de carga**: Optimizado (código minimal)
- **Mobile-friendly**: 100% responsive
- **CTAs visibles**: 7 puntos de conversión
- **WhatsApp integration**: Directa y sin fricción

---

## 💡 NOTAS IMPORTANTES

1. **Todas las imágenes son placeholders**: Reemplázalas con tus fotos reales
2. **El mapa usa coordenadas de ejemplo**: Actualízalo con tu ubicación
3. **Los enlaces de redes sociales son ejemplos**: Cámbialos por tus perfiles reales
4. **El número de WhatsApp está configurado**: 59178555886

---

## 🎨 INSPIRACIÓN

Diseño basado en:

- **Gino's Pizza**: Cards minimalistas, CTAs claros
- **Conversión máxima**: Múltiples puntos de contacto
- **Mobile-first**: Experiencia optimizada para móvil

---

## ✅ CHECKLIST DE PERSONALIZACIÓN

- [ ] Reemplazar imagen del hero (`/hero-bg.jpg`)
- [ ] Reemplazar imágenes de cortes (6 imágenes)
- [ ] Actualizar coordenadas del mapa
- [ ] Cambiar enlaces de redes sociales
- [ ] Verificar número de WhatsApp
- [ ] Ajustar horarios si es necesario
- [ ] Personalizar textos y descripciones

---

**¡Tu sitio está listo para usar! 🚀**

Solo necesitas personalizar las imágenes y algunos datos, y estará 100% funcional.
