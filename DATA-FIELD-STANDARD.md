# Data Field Styling Standard

## Golden Reference: Add Customer & Add Inventory Item Forms

These two forms have the CORRECT styling that should be used across ALL data entry forms in the application.

## ✅ CORRECT Input Field Styling

### Text Input Fields

```jsx
<input
  type="text"
  className="input-field"
  placeholder="Enter value"
/>
```

**CSS Styles:**
```css
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;        /* 12px top/bottom, 16px left/right */
  background: #111827;           /* Dark gray background */
  border: 1px solid #374151;     /* Gray border */
  border-radius: 0.5rem;         /* 8px rounded corners */
  color: white;
  font-size: 1rem;               /* 16px font size */
}

.input-field:focus {
  outline: none;
  border-color: #FFD700;         /* Golden border on focus */
  box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);  /* Golden glow */
}

.input-field::placeholder {
  color: #9CA3AF;                /* Gray placeholder text */
}
```

### Textarea Fields

```jsx
<textarea
  rows={4}
  className="input-field"
  placeholder="Enter notes..."
/>
```

**Same CSS as input fields** - use the `.input-field` class

### Select Dropdowns

```jsx
<select className="input-field">
  <option value="">Select...</option>
  <option value="option1">Option 1</option>
</select>
```

**Same CSS as input fields** - use the `.input-field` class

### Labels

```jsx
<label htmlFor="fieldName" className="form-label">
  Field Name *
</label>
```

**CSS Styles:**
```css
.form-label {
  display: block;
  font-size: 0.875rem;           /* 14px */
  font-weight: 500;              /* Medium weight */
  color: #9CA3AF;                /* Gray-400 */
  margin-bottom: 0.5rem;         /* 8px spacing below */
}
```

### Error State

```jsx
<input
  className={`input-field ${formErrors.name ? 'error' : ''}`}
/>
{formErrors.name && (
  <p className="error-text">{formErrors.name}</p>
)}
```

**CSS Styles:**
```css
.input-field.error {
  border-color: #ef4444;         /* Red border */
}

.input-field.error:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1);  /* Red glow */
}

.error-text {
  margin-top: 0.25rem;           /* 4px spacing above */
  font-size: 0.875rem;           /* 14px */
  color: #ef4444;                /* Red text */
}
```

## ❌ WRONG Patterns to Avoid

### DO NOT USE: Tiny padding

```css
/* WRONG - too small */
padding: 0.25rem 0.5rem;  /* Only 4px/8px */
padding: 0.5rem;          /* Only 8px */
```

### DO NOT USE: Wrong background colors

```css
/* WRONG - too light or wrong shade */
background: rgba(255, 255, 255, 0.05);  /* Too transparent */
background: #000;                       /* Too dark */
background: #1F2937;                    /* Wrong shade */
```

### DO NOT USE: Wrong border colors

```css
/* WRONG - inconsistent borders */
border: 1px solid rgba(255, 215, 0, 0.2);  /* Golden borders in default state */
border: 1px solid rgba(255, 255, 255, 0.1); /* Too transparent */
border: 1px solid #1F2937;                   /* Wrong shade */
```

### DO NOT USE: Wrong font sizes

```css
/* WRONG - too small */
font-size: 0.875rem;  /* 14px is too small for inputs */
font-size: 0.75rem;   /* 12px is way too small */

/* WRONG - too large */
font-size: 1.125rem;  /* 18px is too large */
```

## 📐 Complete Form Layout Example

```jsx
<div className="flex-1 overflow-y-auto px-4 py-4">
  <form onSubmit={handleSubmit} className="space-y-4">
    {/* Text Field */}
    <div>
      <label htmlFor="name" className="form-label">
        Customer Name *
      </label>
      <input
        id="name"
        type="text"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        className={`input-field ${formErrors.name ? 'error' : ''}`}
        placeholder="Enter customer name"
      />
      {formErrors.name && (
        <p className="error-text">{formErrors.name}</p>
      )}
    </div>

    {/* Email Field */}
    <div>
      <label htmlFor="email" className="form-label">
        Email Address *
      </label>
      <input
        id="email"
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        className={`input-field ${formErrors.email ? 'error' : ''}`}
        placeholder="customer@example.com"
      />
      {formErrors.email && (
        <p className="error-text">{formErrors.email}</p>
      )}
    </div>

    {/* Select Dropdown */}
    <div>
      <label htmlFor="category" className="form-label">
        Category
      </label>
      <select
        id="category"
        value={formData.category}
        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
        className="input-field"
      >
        <option value="">Select category...</option>
        <option value="equipment">Equipment</option>
        <option value="materials">Materials</option>
      </select>
    </div>

    {/* Textarea */}
    <div>
      <label htmlFor="notes" className="form-label">
        Notes
      </label>
      <textarea
        id="notes"
        value={formData.notes}
        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        rows={4}
        className="input-field"
        placeholder="Additional notes..."
      />
    </div>
  </form>
</div>
```

## 📊 Size Comparison

| Element | Correct Size | Wrong Sizes to Avoid |
|---------|-------------|---------------------|
| Input padding | `0.75rem 1rem` (12px 16px) | `0.5rem`, `0.25rem 0.5rem` |
| Input font size | `1rem` (16px) | `0.875rem`, `0.75rem` |
| Label font size | `0.875rem` (14px) | `0.75rem`, `1rem` |
| Border radius | `0.5rem` (8px) | `0.25rem`, `0.75rem` |
| Border width | `1px` | `2px` |
| Background | `#111827` | `rgba(255,255,255,0.05)`, `#000` |
| Border color | `#374151` | `rgba(255,215,0,0.2)`, `rgba(255,255,255,0.1)` |

## 🎨 Color Reference

| Element | Default | Focus | Error |
|---------|---------|-------|-------|
| Background | `#111827` | `#111827` | `#111827` |
| Border | `#374151` | `#FFD700` | `#ef4444` |
| Text | `white` | `white` | `white` |
| Placeholder | `#9CA3AF` | `#9CA3AF` | `#9CA3AF` |
| Label | `#9CA3AF` | `#9CA3AF` | `#9CA3AF` |
| Glow | none | `0 0 0 2px rgba(255, 215, 0, 0.1)` | `0 0 0 2px rgba(239, 68, 68, 0.1)` |

## 📝 Pages Using Correct Styling

1. ✅ **Add Customer** (`/supervisor/customers` - create/edit form)
2. ✅ **Add Inventory Item** (`/supervisor/inventory` - add form)

## 📝 Pages That Need Fixing

Check ALL other forms across the application and ensure they match this standard:

- Properties add/edit form
- Jobs create form
- Any other data entry forms

## 🔍 How to Audit

1. Check input field `padding` - should be `0.75rem 1rem`
2. Check input field `font-size` - should be `1rem`
3. Check input field `background` - should be `#111827`
4. Check input field `border` - should be `1px solid #374151`
5. Check label `font-size` - should be `0.875rem`
6. Check label `color` - should be `#9CA3AF`

If any of these don't match, update to match the standard.
