# UI Consistency Specification

**Date**: 2025-10-15
**Purpose**: Establish consistent UI standards across all pages

---

## 🎨 Design System

### Mobile Container
```css
width: 100%;
max-width: 375px;
height: 100vh;
max-height: 812px;
margin: 0 auto;
background: #000;
color: white;
```

### Typography

**Headings**:
- Page Title (H1): `text-xl font-semibold` (20px)
- Section Title (H2): `text-lg font-semibold` (18px)
- Card Title (H3): `text-base font-semibold` (16px)
- Subtitle: `text-sm` (14px)
- Caption: `text-xs` (12px)

**Body Text**:
- Default: `text-base` (16px)
- Small: `text-sm` (14px)
- Tiny: `text-xs` (12px)

### Colors

**Primary**:
- Golden Yellow: `#FFD700`
- Black Background: `#000`
- White Text: `#FFF`

**Grays**:
- Gray 900: `#111` (dark cards)
- Gray 800: `#1f1f1f` (inputs)
- Gray 700: `#333` (borders)
- Gray 500: `#6b7280` (secondary text)
- Gray 400: `#9ca3af` (disabled text)

**Semantic**:
- Success: `#22c55e`
- Warning: `#f97316`
- Error: `#ef4444`
- Info: `#3b82f6`

---

## 📦 Component Standards

### Buttons

**Primary Button**:
```css
padding: 0.75rem 1rem;
background: #FFD700;
color: #000;
font-weight: 600;
font-size: 0.875rem (14px);
border-radius: 0.5rem (8px);
border: none;
```

**Secondary Button**:
```css
padding: 0.75rem 1rem;
background: rgba(255, 255, 255, 0.1);
color: white;
font-weight: 600;
font-size: 0.875rem (14px);
border-radius: 0.5rem (8px);
border: 1px solid rgba(255, 215, 0, 0.3);
```

**Icon Button**:
```css
padding: 0.375rem (6px);
background: rgba(255, 255, 255, 0.1);
color: white;
border: 1px solid rgba(255, 215, 0, 0.2);
border-radius: 0.375rem (6px);
```

**Back Button** (standardized):
```css
display: flex;
align-items: center;
gap: 0.5rem;
padding: 0.75rem 1rem;
background: rgba(255, 255, 255, 0.05);
color: white;
font-weight: 600;
font-size: 0.875rem (14px);
border-radius: 0.5rem (8px);
border: 1px solid rgba(255, 215, 0, 0.2);
```

### Input Fields

**Text Input**:
```css
width: 100%;
padding: 0.75rem (12px);
font-size: 0.875rem (14px);
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 215, 0, 0.2);
border-radius: 0.5rem (8px);
color: white;
placeholder-color: #6b7280;
```

**Label**:
```css
display: block;
margin-bottom: 0.5rem (8px);
font-size: 0.875rem (14px);
font-weight: 600;
color: white;
```

**Select/Dropdown**:
```css
width: 100%;
padding: 0.75rem (12px);
font-size: 0.875rem (14px);
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 215, 0, 0.2);
border-radius: 0.5rem (8px);
color: white;
```

### Cards

**Standard Card**:
```css
background: rgba(255, 255, 255, 0.05);
border: 1px solid rgba(255, 215, 0, 0.2);
border-radius: 0.75rem (12px);
padding: 1rem (16px);
```

**Hover Effect**:
```css
:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 215, 0, 0.4);
  transform: translateX(2px);
}
```

### Headers

**Page Header**:
```css
display: flex;
align-items: center;
justify-content: space-between;
padding: 1rem (16px);
border-bottom: 1px solid #333;
background: rgba(0, 0, 0, 0.9);
```

**Header Title**:
```css
font-size: 1.25rem (20px);
font-weight: 600;
```

**Header Subtitle**:
```css
font-size: 0.75rem (12px);
color: #6b7280;
```

### Bottom Action Bar

```css
display: flex;
gap: 0.75rem (12px);
padding: 1rem (16px);
background: rgba(0, 0, 0, 0.95);
border-top: 1px solid #333;
```

---

## 📱 Page Structure

Every page should follow this structure:

```typescript
<div className="mobile-container">
  {/* Header */}
  <div className="header-bar">
    <div className="flex items-center gap-2">
      <IconComponent className="w-6 h-6" style={{ color: '#FFD700' }} />
      <div>
        <h1 className="text-xl font-semibold">Page Title</h1>
        <p className="text-xs text-gray-500">Subtitle</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {/* Actions */}
    </div>
  </div>

  {/* Main Content */}
  <div className="flex-1 overflow-y-auto">
    <div className="p-4 space-y-4">
      {/* Content */}
    </div>
  </div>

  {/* Bottom Actions (if needed) */}
  <div className="bottom-actions">
    <button className="btn-secondary flex-1">
      <ArrowLeft className="w-5 h-5 mr-2" />
      Back
    </button>
    <button className="btn-primary flex-1">
      <Save className="w-5 h-5 mr-2" />
      Save
    </button>
  </div>
</div>
```

---

## 🔧 Inconsistencies Found

### Login Page
- ❌ Using larger font sizes (text-5xl for title, text-xl for subtitle)
- ❌ Input padding is `px-6 py-4` (should be `px-3 py-3`)
- ❌ Input font size is `text-lg` (should be `text-sm`)
- ❌ Button padding is `py-5` (should be `py-3`)
- ❌ Button font size is `text-xl` (should be `text-sm`)
- ❌ Inconsistent border-radius (rounded-xl = 12px, should be 8px for inputs)
- ❌ Border width is `border-2` (should be `border` = 1px)

### Supervisor Pages
- ❌ Some pages use `btn-primary`, others use `.action-button.primary`
- ❌ Back buttons have inconsistent styling
- ❌ Form input sizes vary between pages
- ❌ Menu buttons (hamburger) not standardized

---

## ✅ Fixes Required

1. **Login Page**:
   - Reduce title size from `text-5xl` to `text-2xl`
   - Reduce subtitle from `text-xl` to `text-sm`
   - Change input padding from `px-6 py-4` to `px-3 py-3`
   - Change input font from `text-lg` to `text-sm`
   - Change button padding from `py-5` to `py-3`
   - Change button font from `text-xl` to `text-sm`
   - Standardize border-radius to `rounded-lg` (8px)
   - Use `border` instead of `border-2`

2. **All Supervisor Pages**:
   - Standardize back button class to `btn-secondary`
   - Ensure all inputs use consistent padding `px-3 py-3`
   - Ensure all buttons use consistent sizing
   - Add standard menu button if missing

3. **Component Classes to Add**:
   ```css
   .btn-primary {
     display: flex;
     align-items: center;
     justify-content: center;
     padding: 0.75rem 1rem;
     background: #FFD700;
     color: #000;
     font-weight: 600;
     border-radius: 0.5rem;
     border: none;
     font-size: 0.875rem;
   }

   .btn-secondary {
     display: flex;
     align-items: center;
     justify-content: center;
     padding: 0.75rem 1rem;
     background: rgba(255, 255, 255, 0.1);
     color: white;
     font-weight: 600;
     border-radius: 0.5rem;
     border: 1px solid rgba(255, 215, 0, 0.3);
     font-size: 0.875rem;
   }

   .form-input {
     width: 100%;
     padding: 0.75rem;
     font-size: 0.875rem;
     background: rgba(255, 255, 255, 0.05);
     border: 1px solid rgba(255, 215, 0, 0.2);
     border-radius: 0.5rem;
     color: white;
   }

   .form-label {
     display: block;
     margin-bottom: 0.5rem;
     font-size: 0.875rem;
     font-weight: 600;
     color: white;
   }
   ```

---

## 📊 Implementation Priority

1. **High Priority** (user-facing):
   - Login page consistency
   - Button sizing across all pages
   - Input field consistency

2. **Medium Priority** (UX):
   - Back button standardization
   - Menu button implementation
   - Card hover effects

3. **Low Priority** (polish):
   - Animation consistency
   - Icon sizing
   - Spacing refinements

---

**Next Steps**:
1. Fix login page to match supervisor pages
2. Create shared component classes
3. Apply consistently across all pages
4. Test on actual device (iPhone SE size: 375x667)

