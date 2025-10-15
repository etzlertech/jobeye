# Golden Standard Styling Guide

**Reference Pages**: `src/app/supervisor/properties/page.tsx` and `src/app/supervisor/inventory/page.tsx`

## Core Design Tokens

### Colors
- **Background**: `#000` (pure black)
- **Primary (Golden)**: `#FFD700`
- **Primary Hover**: `#FFC700`
- **Border Dark**: `#333`
- **Border Subtle**: `rgba(255, 215, 0, 0.2)`
- **Card Background**: `rgba(255, 255, 255, 0.05)`
- **Card Hover**: `rgba(255, 255, 255, 0.08)`
- **Success Background**: `rgba(255, 215, 0, 0.1)`
- **Error Background**: `rgba(239, 68, 68, 0.1)`

### Typography
- **Heading (h1)**: `text-xl font-semibold`
- **Subtitle**: `text-xs text-gray-500`
- **Label**: `text-sm font-medium text-gray-400`
- **Body Text**: `text-white`
- **Muted Text**: `text-gray-400`, `text-gray-500`

### Spacing
- **Container Padding**: `1rem` (16px)
- **Card Padding**: `1rem`
- **Form Field Spacing**: `space-y-4`
- **Button Gap**: `gap-0.75rem` (12px)

### Components

#### 1. Mobile Container
```css
.mobile-container {
  width: 100%;
  max-width: 375px;
  height: 100vh;
  max-height: 812px;
  margin: 0 auto;
  background: #000;
  color: white;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

#### 2. Header Bar
```css
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid #333;
  background: rgba(0, 0, 0, 0.9);
}
```

#### 3. Notification Bars
```css
.notification-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  margin: 0.5rem 1rem;
  border-radius: 0.5rem;
}

.notification-bar.error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.notification-bar.success {
  background: rgba(255, 215, 0, 0.1);
  border: 1px solid rgba(255, 215, 0, 0.3);
}
```

#### 4. Primary Button
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
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #FFC700;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

#### 5. Secondary Button
```css
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
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: #FFD700;
}
```

#### 6. Bottom Actions Bar
```css
.bottom-actions {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.9);
  border-top: 1px solid #333;
}
```

#### 7. List Cards
```css
.item-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 0.75rem;
  padding: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 215, 0, 0.4);
  transform: translateX(2px);
}
```

#### 8. Form Fields
```css
/* Input/Select/Textarea */
.input-field {
  width: 100%;
  padding: 0.75rem 1rem;
  background: #111827;
  border: 1px solid #374151;
  border-radius: 0.5rem;
  color: white;
  font-size: 1rem;
}

.input-field:focus {
  outline: none;
  border-color: #FFD700;
  box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.1);
}

.input-field::placeholder {
  color: #9CA3AF;
}
```

#### 9. Icon Buttons
```css
.icon-button {
  padding: 0.375rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
}

.icon-button:hover {
  background: rgba(255, 215, 0, 0.2);
  border-color: #FFD700;
}
```

#### 10. Empty State
```css
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
}
```

## Event Handling Pattern

All interactive buttons must include:
```tsx
<button
  type="button"
  onClick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    // handler logic
  }}
>
```

## Mobile-First Principles
- Container width: 375px (iPhone SE)
- Container height: 812px max
- All content must be scrollable within flex container
- Bottom actions must be fixed at bottom
- Header must be fixed at top

## Do NOT Change
- React hooks (useState, useEffect, useCallback)
- Data fetching logic
- API calls
- Form validation logic
- CRUD operations
- Route navigation logic
