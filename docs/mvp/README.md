# MVP Intent-Driven Mobile App - Feature 007

> **Status**: ✅ COMPLETE | **Version**: 1.0.0 | **Date**: 2025-01-27

## Overview

The MVP Intent-Driven Mobile App is a voice-first, camera-enabled field service management Progressive Web App (PWA) designed for single-company deployment with role-based access control. The app supports offline-first workflows with IndexedDB storage and background sync.

## Key Features

### 🎤 Voice-First Interface
- **Speech-to-Text (STT)**: Web Speech API integration
- **Text-to-Speech (TTS)**: Voice responses and navigation
- **Intent Recognition**: Camera-based workflow triggers
- **Voice Commands**: "Take photo", "Start job", "Where am I"

### 📱 Mobile-Optimized UI
- **4-Button Maximum**: Simplified interface per screen
- **512x512 Thumbnails**: Consistent image sizing
- **Touch-Friendly**: Large tap targets and gestures
- **PWA Support**: Install to home screen, offline access

### 👥 Role-Based Access Control
- **Super Admin**: Company management and user roles
- **Supervisor**: Job creation and crew assignment
- **Crew Member**: Job execution and load verification

### 📷 Camera-Based Intent Recognition
- **VLM Integration**: Visual Language Model analysis
- **Offline Detection**: Local YOLO inference for equipment
- **Hybrid Pipeline**: Cost-optimized cloud fallback
- **Multi-Container**: Track items across truck/trailer/storage

### 🔄 Offline-First Architecture
- **IndexedDB Storage**: Local data persistence
- **Background Sync**: Automatic data synchronization
- **Priority Queue**: Critical operations first
- **Conflict Resolution**: Smart merge strategies

## Architecture

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **Storage**: IndexedDB, Supabase Storage
- **AI/ML**: OpenAI GPT-4 Vision, YOLO v11n ONNX
- **PWA**: Service Worker, Web App Manifest

### Core Systems

#### Intent Recognition Pipeline
```
Camera Capture → VLM Analysis → Intent Classification → Workflow Trigger
```

#### Voice Processing Pipeline
```
STT → Intent Recognition → Action Processing → TTS Response
```

#### Offline Data Flow
```
User Action → IndexedDB Queue → Background Sync → Supabase → Real-time Updates
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key (optional for VLM)

### Installation

1. **Clone and Install**
   ```bash
   git clone [repository]
   cd jobeye
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Configure required environment variables
   ```

3. **Database Setup**
   ```bash
   npm run db:migrate
   npm run generate:types
   ```

4. **Development Server**
   ```bash
   npm run dev
   ```

5. **Access the App**
   - Open http://localhost:3000
   - Default roles: Super Admin, Supervisor, Crew

### Environment Variables

Required variables in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key (optional)
```

## User Roles & Workflows

### Super Admin
- **Dashboard**: Company overview and user management
- **Role Management**: Assign/modify user roles
- **System Settings**: Configure company preferences
- **Audit Trail**: View system logs and activities

### Supervisor
- **Job Creation**: Create jobs with voice instructions
- **Crew Assignment**: Assign jobs to crew members
- **Progress Monitoring**: Track job completion status
- **Load Verification**: Review crew equipment photos

### Crew Member
- **Job Dashboard**: View assigned jobs for the day
- **Load Verification**: Camera-based equipment verification
- **Job Execution**: Start/complete jobs with voice commands
- **Voice Recording**: Leave voice notes for supervisors

## API Endpoints

### Intent Recognition
- `POST /api/intent/recognize` - Analyze image for intent
- `GET /api/intent/history` - Intent recognition history

### Supervisor Operations
- `POST /api/supervisor/jobs` - Create new job
- `GET /api/supervisor/jobs` - List supervisor jobs
- `POST /api/supervisor/voice` - Upload voice instruction

### Crew Operations
- `GET /api/crew/jobs` - Get assigned jobs
- `POST /api/crew/verify` - Submit load verification
- `PATCH /api/crew/jobs/:id` - Update job status

### Vision Integration
- `POST /api/vision/verify` - Equipment verification
- `GET /api/vision/cost/summary` - Cost monitoring

## Development Commands

### Common Tasks
```bash
npm run dev              # Start development server
npm run build           # Build for production
npm run test            # Run test suite
npm run test:watch      # Watch mode testing
npm run test:e2e        # End-to-end tests
```

### Architecture & Code Quality
```bash
npm run lint:directives  # Validate directive blocks
npm run validate:deps    # Check dependency graph
npm run check:complexity # File complexity analysis
npm run report:progress  # Generate progress manifest
```

### Database & Types
```bash
npm run generate:types   # Generate TypeScript types
npm run db:migrate      # Run migrations
npm run check:db-actual # Verify actual database schema
```

### Performance & Monitoring
```bash
npm run railway:monitor <id>     # Monitor Railway deployment
npm run railway:build-logs <id>  # View build logs
npm run railway:deploy-logs <id> # View deployment logs
```

## Testing Strategy

### Test Coverage
- **Unit Tests**: >90% coverage target
- **Integration Tests**: API endpoints and database operations
- **E2E Tests**: Critical user workflows
- **Visual Tests**: Component rendering and accessibility

### Test Structure
```
tests/
├── unit/           # Jest unit tests
├── integration/    # API and database tests
├── e2e/           # Playwright end-to-end tests
└── fixtures/      # Test data and mocks
```

### Running Tests
```bash
npm run test                    # All tests
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests
npm run test:e2e              # End-to-end tests
npm run test:coverage         # Coverage report
```

## Performance Optimizations

### Caching Strategy
- **Multi-layer Cache**: Memory, persistent, IndexedDB
- **Image Optimization**: Progressive loading, compression
- **API Caching**: Intelligent TTL based on data type
- **Service Worker**: Offline resource caching

### Performance Monitoring
- **Core Web Vitals**: FCP, LCP, FID, CLS tracking
- **Custom Metrics**: Voice latency, cache hit rates
- **Real-time Monitoring**: Performance dashboard
- **Automatic Optimization**: Battery saving, network adaptation

### Bundle Optimization
- **Code Splitting**: Route-based chunks
- **Tree Shaking**: Remove unused code
- **Image Optimization**: WebP conversion, lazy loading
- **Font Optimization**: Preload critical fonts

## Accessibility Features

### Voice Navigation
- **Voice Commands**: "Go home", "Take photo", "Start job"
- **Audio Descriptions**: Element and page descriptions
- **Keyboard Shortcuts**: Alt+V (toggle), Alt+H (help)
- **Screen Reader**: Full compatibility

### Visual Accessibility
- **High Contrast Mode**: Enhanced visibility
- **Large Text Option**: Scalable font sizes
- **Reduced Motion**: Respect user preferences
- **Focus Management**: Clear focus indicators

### Navigation Aids
- **Skip Links**: Jump to main content
- **Landmarks**: Proper ARIA structure
- **Alternative Text**: All images described
- **Keyboard Navigation**: Full keyboard access

## Security & Privacy

### Authentication
- **Supabase Auth**: Secure user authentication
- **JWT Tokens**: Stateless session management
- **Role-Based Access**: Granular permissions
- **Session Management**: Automatic token refresh

### Data Protection
- **Row Level Security**: Database-level isolation
- **API Security**: Rate limiting and validation
- **File Upload Security**: Type and size validation
- **Privacy Controls**: User data preferences

### Offline Security
- **Encrypted Storage**: Sensitive data encryption
- **Sync Security**: Secure background synchronization
- **Access Control**: Offline permission enforcement
- **Data Integrity**: Conflict resolution and validation

## Deployment

### Production Build
```bash
npm run build
npm run start
```

### Railway Deployment
The app is configured for Railway.app deployment with:
- **Nixpacks**: Automatic build detection
- **Environment Variables**: Secure configuration
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage for files

### Docker Support
```bash
docker build -t jobeye-mvp .
docker run -p 3000:3000 jobeye-mvp
```

## Monitoring & Analytics

### Performance Tracking
- **Real-time Metrics**: FPS, memory usage, network latency
- **User Analytics**: Feature usage, error rates
- **Cost Monitoring**: AI/VLM usage tracking
- **System Health**: Service availability monitoring

### Error Handling
- **Automatic Recovery**: Network, IndexedDB, voice errors
- **Circuit Breaker**: API failure protection
- **Graceful Degradation**: Offline functionality
- **Error Reporting**: Structured error logging

## Known Limitations

### Current Constraints
- **Single Company**: Not multi-tenant ready
- **Job Limit**: 6 jobs per crew per day
- **VLM Budget**: $10/day cost cap
- **Storage Limit**: 50 photos in offline queue

### Browser Support
- **Chrome/Edge**: Full feature support
- **Safari**: Limited voice synthesis
- **Firefox**: Basic functionality
- **Mobile**: Chrome Mobile recommended

## Roadmap

### Phase 4: Advanced Features
- **Multi-tenant Support**: Multiple companies
- **Advanced Analytics**: Detailed reporting
- **Integration APIs**: Third-party connections
- **Advanced AI**: Improved intent recognition

### Phase 5: Enterprise
- **SSO Integration**: Enterprise authentication
- **Advanced Security**: Compliance features
- **Custom Workflows**: Configurable processes
- **White Label**: Branded deployments

## Support & Troubleshooting

### Common Issues

1. **Voice Not Working**
   - Check browser permissions
   - Ensure HTTPS connection
   - Try different browser

2. **Camera Access Denied**
   - Grant camera permissions
   - Check privacy settings
   - Restart browser

3. **Offline Sync Issues**
   - Check network connectivity
   - Clear IndexedDB cache
   - Restart service worker

### Getting Help
- **Documentation**: `/docs` directory
- **API Reference**: `/docs/api`
- **Architecture Guide**: `/docs/architecture`
- **Troubleshooting**: `/docs/troubleshooting`

### Development Support
- **Claude.md**: Project instructions for AI assistance
- **Directive Blocks**: Inline documentation
- **Test Coverage**: Comprehensive test suite
- **Type Safety**: Full TypeScript coverage

---

**Built with ❤️ using Architecture-as-Code methodology**