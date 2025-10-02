# MVP User Guide

> **Feature 007**: Intent-Driven Mobile App User Documentation

## Getting Started

### What is JobEye MVP?

JobEye MVP is a voice-first, camera-enabled field service management app designed for landscape and maintenance crews. The app helps you manage jobs, verify equipment, and communicate with your team using voice commands and photo recognition.

### Key Features
- 🎤 **Voice Commands**: Control the app with your voice
- 📷 **Smart Camera**: Automatic equipment detection
- 📱 **Mobile-First**: Optimized for phones and tablets
- 🔄 **Works Offline**: Continue working without internet
- 👥 **Role-Based**: Different features for admins, supervisors, and crew

## Installation

### Option 1: Install as PWA (Recommended)
1. Open https://your-app.railway.app in Chrome or Safari
2. Tap the "Install" button in your browser
3. Choose "Add to Home Screen"
4. The app icon will appear on your device

### Option 2: Use in Browser
Simply visit the web address and bookmark it for easy access.

### System Requirements
- **Mobile**: iOS 14+ (Safari) or Android 8+ (Chrome)
- **Desktop**: Chrome 90+, Safari 14+, or Edge 90+
- **Permissions**: Camera, microphone, and location access

## User Roles

### Super Admin 👑
**What you can do:**
- Manage company settings
- Add/remove users and assign roles
- View system-wide analytics
- Access all supervisor and crew features

**Typical users:** Company owners, IT administrators

### Supervisor 👷‍♂️
**What you can do:**
- Create and assign jobs to crew members
- Record voice instructions for jobs
- Monitor job progress and completion
- Review crew equipment verification photos

**Typical users:** Foremen, team leaders, operations managers

### Crew Member 🛠️
**What you can do:**
- View assigned jobs for the day
- Verify equipment loads with camera
- Start and complete jobs
- Leave voice notes for supervisors

**Typical users:** Field workers, maintenance staff, drivers

## Voice Commands

### Activating Voice Navigation
- **Keyboard**: Press `Alt + V`
- **Button**: Tap the microphone icon (bottom-right corner)
- **Voice**: Say "activate voice navigation" (when already active)

### Universal Commands
- **"Where am I?"** - Describes current page and available actions
- **"What can I do?"** - Lists available voice commands
- **"Go home"** - Returns to main dashboard
- **"Help"** - Provides context-specific assistance
- **"Stop"** - Stops all voice operations (or press Escape)

### Navigation Commands
- **"Go to dashboard"** - Navigate to your main dashboard
- **"Go to jobs"** - View job list
- **"Go to settings"** - Access user preferences
- **"Go back"** - Return to previous page

### Action Commands
- **"Take photo"** - Open camera for equipment verification
- **"Start job"** - Begin work on selected job
- **"Complete job"** - Mark current job as finished
- **"Record voice note"** - Leave audio message

## Camera Features

### Equipment Recognition
The app automatically detects common landscaping equipment:

**Supported Equipment:**
- Mowers (push, riding, zero-turn)
- Trimmers and edgers
- Blowers (handheld, backpack)
- Hand tools (shovels, rakes, pruners)
- Safety equipment (cones, signs)

### Taking Equipment Photos
1. **Point camera** at equipment spread
2. **Ensure good lighting** - avoid shadows
3. **Include multiple items** in one photo when possible
4. **Wait for detection** - green checkmarks appear on recognized items
5. **Tap capture** or say "take photo"

### Photo Tips
- **Distance**: Stand 6-10 feet back for best results
- **Angle**: Straight-on view works better than side angles
- **Background**: Clear background helps recognition
- **Lighting**: Natural daylight is best, avoid direct sun glare

## Super Admin Guide

### Dashboard Overview
Your dashboard shows:
- Company overview statistics
- Active users and their roles
- System health indicators
- Recent activity logs

### Managing Users
1. **Add New User**
   - Tap "Add User" button
   - Enter email address
   - Select role (Supervisor or Crew)
   - User receives invitation email

2. **Modify User Roles**
   - Find user in the list
   - Tap their name
   - Select new role from dropdown
   - Changes take effect immediately

3. **Deactivate Users**
   - Tap user's settings icon
   - Choose "Deactivate"
   - User loses access but data is retained

### Company Settings
- **Company Name**: Update business name
- **Time Zone**: Set default timezone for scheduling
- **Job Limits**: Configure daily job limits per crew
- **Voice Settings**: Default voice preferences

### Voice Commands for Admins
- **"Show user list"** - Display all company users
- **"Add new user"** - Start user creation process
- **"Show system status"** - Display health indicators
- **"View analytics"** - Access usage statistics

## Supervisor Guide

### Creating Jobs

#### Basic Job Creation
1. **Navigate to Jobs** → "Create New Job"
2. **Enter job details:**
   - Job title (required)
   - Description (optional)
   - Location address
   - Equipment needed
3. **Assign crew members** from dropdown
4. **Set scheduled date and time**
5. **Add voice instructions** (recommended)

#### Adding Voice Instructions
1. **Tap microphone button** during job creation
2. **Record clear instructions** (speak normally, 30 seconds max)
3. **Review transcript** for accuracy
4. **Re-record if needed**
5. **Save job** - crew receives notification with audio

#### Voice Commands for Job Creation
- **"Create new job"** - Start job creation process
- **"Add voice instruction"** - Record audio for current job
- **"Assign to [crew name]"** - Assign job to specific crew member
- **"Set priority high"** - Mark job as high priority
- **"Save job"** - Save and send job to crew

### Monitoring Jobs
Your dashboard shows:
- **Today's Jobs**: All jobs scheduled for today
- **In Progress**: Currently active jobs
- **Completed**: Finished jobs awaiting review
- **Crew Status**: Real-time crew activity

### Reviewing Load Verifications
When crew members submit equipment photos:
1. **Review detected items** against job requirements
2. **Check for missing equipment** (highlighted in red)
3. **Approve or request corrections**
4. **Add notes** if needed

### Voice Commands for Supervisors
- **"Show today's jobs"** - View all jobs for today
- **"Check crew status"** - See which crews are active
- **"Review verifications"** - View pending equipment checks
- **"Create job for [crew name]"** - Quick job creation

## Crew Member Guide

### Daily Workflow

#### 1. Starting Your Day
1. **Open the app** when you arrive at work
2. **Check today's jobs** on your dashboard
3. **Listen to voice instructions** from supervisor
4. **Verify equipment load** before leaving

#### 2. Equipment Verification
1. **Tap "Verify Load"** button
2. **Take photos** of all equipment in truck/trailer
3. **Wait for automatic detection** (items turn green when detected)
4. **Add any missing items** manually if needed
5. **Submit verification** - supervisor gets notified

#### 3. Job Execution
1. **Select job** from your list
2. **Tap "Start Job"** when you arrive at location
3. **Follow voice instructions** from supervisor
4. **Take progress photos** as needed
5. **Record voice notes** for supervisor
6. **Mark "Complete"** when finished

#### 4. End of Day
1. **Complete all assigned jobs**
2. **Take final equipment photos** (post-job verification)
3. **Submit timesheet** if required
4. **Return equipment** to designated area

### Equipment Verification Tips

#### Before Departure
- **Layout equipment** clearly in truck bed or trailer
- **Take wide-angle photo** showing all items
- **Ensure good lighting** - use truck headlights if needed
- **Double-check** against job requirements

#### After Job Completion
- **Photograph returned equipment** in same layout
- **Note any damage** or missing items
- **Clean equipment** before storage
- **Secure tools** properly

### Voice Commands for Crew
- **"Show my jobs"** - Display today's assigned jobs
- **"Start job [job name]"** - Begin work on specific job
- **"Verify equipment"** - Open equipment verification
- **"Record voice note"** - Leave message for supervisor
- **"Complete current job"** - Mark active job as finished
- **"Where is [location]?"** - Get directions to job site

### Job Status Indicators
- 🟦 **Scheduled**: Job assigned but not started
- 🟡 **In Progress**: Currently working on job
- 🟢 **Completed**: Job finished and verified
- 🔴 **Issues**: Problems need supervisor attention

## Accessibility Features

### Voice Navigation
The app is designed for hands-free operation:
- **Full voice control** of all features
- **Audio descriptions** of visual elements
- **Voice feedback** for all actions
- **Keyboard shortcuts** for power users

### Visual Accessibility
- **High contrast mode** for better visibility
- **Large text option** for easier reading
- **Reduced motion** for sensitive users
- **Screen reader compatibility** (NVDA, JAWS, VoiceOver)

### Enabling Accessibility Features
1. **Open Settings** → "Accessibility"
2. **Toggle desired features:**
   - Voice navigation (on by default)
   - High contrast mode
   - Large text
   - Reduced motion
3. **Adjust voice settings:**
   - Speaking rate
   - Voice volume
   - Voice pitch

### Keyboard Shortcuts
- `Alt + V` - Toggle voice navigation
- `Alt + H` - Voice help
- `Alt + M` - Skip to main content
- `Escape` - Stop all voice operations
- `Tab` - Navigate between elements
- `Enter/Space` - Activate buttons

## Offline Features

### What Works Offline
- **View assigned jobs** (if previously loaded)
- **Take equipment photos** (saved locally)
- **Record voice notes** (saved locally)
- **Update job status** (queued for sync)
- **Basic app navigation**

### What Requires Internet
- **Loading new jobs** from supervisor
- **Sending photos** to supervisor
- **Real-time notifications**
- **Voice instruction downloads**
- **Equipment recognition** (reduced accuracy offline)

### Offline Tips
- **Load jobs** while connected to WiFi
- **Take photos freely** - they'll upload when connected
- **Voice notes** are saved locally automatically
- **Sync happens** automatically when connection returns

## Troubleshooting

### Camera Issues

**Camera won't open:**
1. Check browser permissions for camera access
2. Try refreshing the page
3. Close other apps using the camera
4. Restart the browser

**Equipment not detected:**
1. Ensure good lighting conditions
2. Move closer or farther from equipment
3. Try different angles
4. Clean camera lens
5. Check internet connection for cloud processing

### Voice Issues

**Voice commands not recognized:**
1. Check microphone permissions
2. Speak clearly and wait for response
3. Reduce background noise
4. Try different browser (Chrome recommended)
5. Check if you're using supported language (English)

**Voice feedback not working:**
1. Check device volume settings
2. Ensure browser allows audio
3. Try different browser
4. Check accessibility settings

### Login/Access Issues

**Can't log in:**
1. Check email and password spelling
2. Ensure caps lock is off
3. Try "Forgot Password" link
4. Contact your supervisor or admin

**Missing features:**
1. Verify your user role with supervisor
2. Check if feature requires internet connection
3. Try logging out and back in
4. Clear browser cache

### Performance Issues

**App running slowly:**
1. Close unnecessary browser tabs
2. Restart browser
3. Clear browser cache and cookies
4. Check available device storage
5. Try different WiFi network

**Photos taking long to upload:**
1. Check internet connection speed
2. Try uploading one photo at a time
3. Use WiFi instead of cellular data
4. Compress photos if very large

## Best Practices

### For All Users
- **Keep app updated** by refreshing occasionally
- **Use WiFi** when available for better performance
- **Clear browser cache** weekly for optimal performance
- **Report issues** to your supervisor promptly

### For Photos
- **Take photos** in good lighting when possible
- **Include context** - show full work area
- **Avoid blurry images** - hold camera steady
- **Multiple angles** help with equipment recognition

### For Voice
- **Speak clearly** at normal pace
- **Use simple commands** - avoid complex sentences
- **Wait for response** before next command
- **Reduce background noise** when possible

### For Security
- **Log out** when finished for the day
- **Don't share** login credentials
- **Use secure WiFi** networks when possible
- **Report suspicious activity** to administrator

## Getting Help

### In-App Help
- **Voice help**: Say "what can I do" or "help"
- **Keyboard shortcut**: Press `Alt + H`
- **Context help**: Available on each page

### Contact Support
- **Supervisor**: For job-related questions
- **Admin**: For account access issues
- **Technical Support**: For app functionality problems

### Training Resources
- **Video tutorials**: Available in app settings
- **Quick reference**: Downloadable command list
- **FAQs**: Common questions and solutions

---

**Welcome to JobEye MVP! We hope this guide helps you get the most out of your voice-first field service experience.**