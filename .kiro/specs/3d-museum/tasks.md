# Implementation Plan

- [x] 1. Set up project structure and dependencies

  - Initialize Next.js 16+ project with App Router and TypeScript
  - Install Three.js, React Three Fiber, and Drei helpers
  - Install Clerk for authentication
  - Install Drizzle ORM and drizzle-kit for migrations
  - Configure Neon Postgres connection with Drizzle
  - Install Partykit and partysocket for real-time multiplayer
  - Install Zustand for state management
  - Install Tailwind CSS for styling
  - Configure Google Cloud Storage SDK
  - Configure Google Imagen API client
  - Set up environment variables structure (including Partykit host and secret)
  - _Requirements: 1.1, 1.2, 16.1_

- [x] 2. Configure authentication with Clerk

  - Set up Clerk provider in root layout
  - Configure Google OAuth provider in Clerk dashboard
  - Create authentication middleware for protected routes
  - Implement user profile creation webhook handler at `/api/auth/callback`
  - Store user profile picture URL from Google in database
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Set up database schema and migrations

  - Define Drizzle schema for users, museums, frames, and comments tables
  - Create initial migration using drizzle-kit generate
  - Add indexes for userId, shareToken, museumId, frameId, and createdAt fields
  - Run migration using drizzle-kit push or migrate
  - Create seed script with test data for development
  - _Requirements: 1.2, 9.1, 9.2, 9.3, 11.1, 12.2, 17.4_

- [ ] 4. Implement museum API routes

  - Create `GET /api/museums` to list user's museums
  - Create `POST /api/museums` to create new museum with default structure
  - Create `GET /api/museums/[id]` to fetch museum details with frames
  - Create `PATCH /api/museums/[id]` to update museum name and public status
  - Create `DELETE /api/museums/[id]` to soft delete museum
  - Create `GET /api/museums/[id]/share` to generate unique share token
  - Implement authentication checks for all protected routes
  - _Requirements: 11.1, 11.3, 12.1, 12.2, 12.3_

- [ ] 5. Implement frame API routes

  - Create `GET /api/museums/[id]/frames` to list all frames in museum
  - Create `POST /api/museums/[id]/frames` to create or update frame with image
  - Create `DELETE /api/museums/[id]/frames/[frameId]` to remove frame image
  - Create `GET /api/frames/[id]/share` to generate frame-specific share token
  - Validate frame position limits (max 30 frames per museum)
  - _Requirements: 4.5, 6.5, 8.4, 8.5, 13.2_

- [ ] 6. Implement image upload functionality

  - Create `POST /api/images/upload` route for image uploads
  - Integrate Google Cloud Storage SDK for file storage
  - Validate file type (JPEG, PNG, WebP) and size (max 10MB)
  - Generate unique filenames using cuid
  - Compress and optimize images to WebP format
  - Generate multiple sizes (thumbnail, medium, full) for performance
  - Return signed URLs with expiration
  - Extract theme colors from uploaded images using color-thief library
  - _Requirements: 6.4, 6.5, 9.2, 9.3, 15.1_

- [ ] 7. Implement AI image generation

  - Create `POST /api/images/generate` route for AI generation
  - Integrate Google Imagen API client
  - Accept prompt text and style preset parameters
  - Map style presets (Van Gogh, Impressionist) to Imagen parameters
  - Handle API rate limits and errors gracefully
  - Store generated images in Google Cloud Storage
  - Extract theme colors from generated images
  - _Requirements: 7.4, 7.5, 7.6, 9.3_

- [ ] 8. Implement public access routes

  - Create `GET /api/public/museums/[shareToken]` for public museum access
  - Create `GET /api/public/frames/[shareToken]` for frame-specific links
  - Return museum data without authentication requirement
  - Include spawn position for frame-specific shares
  - Implement rate limiting on public endpoints
  - _Requirements: 12.4, 13.3, 14.1_

- [ ] 9. Create Zustand store for global state

  - Define MuseumStore interface with current museum, frames, and UI state
  - Implement actions for setting museum, updating frames, deleting frames
  - Add theme mode toggle action
  - Add selected frame state management
  - Implement tutorial dismissal state
  - Add multiplayer state: visitors map and visitor count
  - Implement visitor management actions (add, update, remove visitors)
  - _Requirements: 10.4, 2.4, 16.2, 16.3, 16.4_

- [ ] 10. Build Museum Scene Manager component

  - Initialize Three.js scene with WebGLRenderer
  - Configure renderer settings for performance (powerPreference, pixelRatio)
  - Set up perspective camera with appropriate FOV
  - Implement day theme lighting (directional light, ambient light)
  - Implement night theme lighting (reduced intensity, moonlight effect)
  - Add theme toggle listener to switch lighting configurations
  - Enable frustum culling and occlusion
  - _Requirements: 10.1, 10.2, 10.3, 15.4_

- [ ] 11. Build Museum Layout Generator

  - Create function to generate Main Hall geometry (walls, floor, ceiling)
  - Position 9 frame entities in 3x3 grid on back wall of Main Hall
  - Create function to generate Extendable Hall corridor
  - Implement alternating left-right frame placement algorithm
  - Add new frame position when previous frame is filled
  - Place portal entity at end of Extendable Hall
  - Generate collision boundaries for walls
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.4_

- [ ] 12. Build Frame Entity component

  - Create frame mesh with picture frame geometry
  - Implement texture loading system with lazy loading (load within 15 units)
  - Add LOD system (high-res < 10 units, low-res > 10 units)
  - Implement raycasting for hover detection
  - Display circle indicator for empty frames on hover
  - Display highlight indicator for filled frames on hover
  - Remove indicators when camera moves away (< 100ms)
  - Compress textures to WebP and generate mipmaps
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 15.1, 15.3_

- [ ] 13. Implement desktop navigation controls

  - Integrate PointerLockControls for first-person camera
  - Implement WASD keyboard movement with 5 units/second speed
  - Implement mouse look for camera rotation
  - Add collision detection with walls and boundaries
  - Lock pointer on canvas click, unlock on ESC
  - _Requirements: 3.1, 3.2_

- [ ] 14. Implement mobile navigation controls

  - Add virtual joystick component for movement (bottom-left position)
  - Implement touch drag for camera rotation
  - Set movement speed to 3 units/second for mobile
  - Disable pinch-to-zoom
  - Add collision detection for mobile movement
  - _Requirements: 3.3, 3.4_

- [ ] 15. Build Frame Interaction Modal component

  - Create modal UI with backdrop and close button
  - Implement empty frame state: Upload, Camera Capture, AI Generate sections
  - Add file input for device upload with type and size validation
  - Add camera capture button with device camera API integration
  - Add AI generation form with prompt input and style dropdown
  - Implement filled frame state: View Details, Edit, Delete, Share buttons
  - Display image, description, and theme colors in details view
  - Pause 3D navigation when modal is open
  - Close modal on ESC key or outside click
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

- [ ] 16. Implement frame interaction logic

  - Add click event listener to Frame Entity components
  - Open Frame Interaction Modal with appropriate state (empty/filled)
  - Handle image upload: call upload API, update frame in database, refresh scene
  - Handle camera capture: access device camera, capture image, upload
  - Handle AI generation: call generate API, update frame, refresh scene
  - Handle delete: call delete API, convert frame to empty state
  - Handle share: call share API, copy link to clipboard, show confirmation
  - _Requirements: 6.4, 6.5, 6.6, 7.4, 7.5, 7.6, 8.5, 13.2_

- [ ] 17. Build Profile Overlay component

  - Create overlay UI with user profile picture from Google
  - Display current museum name
  - Add public/private toggle switch
  - Generate and display share link when museum is public
  - Add copy-to-clipboard button for share link
  - Display list of user's museums
  - Add "Create New Museum" button
  - Implement museum creation flow
  - _Requirements: 1.4, 11.2, 12.1, 12.2, 12.3_

- [ ] 18. Build Portal System component

  - Create portal 3D mesh at end of Extendable Hall
  - Add collision detection zone around portal
  - Display museum selection UI when user enters portal zone
  - Fetch user's museums from API
  - Implement museum selection handler
  - Create fade-to-black transition effect
  - Load new museum scene with frames
  - Spawn user at entrance of new museum
  - _Requirements: 11.4, 11.5, 11.6_

- [ ] 19. Build Tutorial Modal component

  - Create modal with welcome message and instructions
  - Add sections for navigation (WASD/joystick), frame interaction, AI generation
  - Include images or GIFs demonstrating features
  - Add dismiss button
  - Store dismissal state in localStorage
  - Update dismissal state in database via API
  - Show tutorial only on first visit per user
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 20. Implement public museum access

  - Create public museum page at `/museum/[shareToken]`
  - Fetch museum data from public API without authentication
  - Load 3D scene with all frames
  - Enable navigation controls for guest visitors
  - Disable frame editing/uploading for guests
  - Show view-only details when guests click frames
  - _Requirements: 12.4, 12.5, 14.1, 14.2, 14.3, 14.4_

- [ ] 21. Implement frame-specific sharing

  - Create frame share page at `/frame/[shareToken]`
  - Fetch frame and museum data from public API
  - Load museum scene and position camera in front of shared frame
  - Allow guest visitor to navigate freely after spawning
  - _Requirements: 13.3, 13.4_

- [ ] 22. Set up Partykit server for multiplayer

  - Create Partykit server file at `/party/museum.ts`
  - Implement connection handler to add visitors to presence map
  - Implement disconnect handler to remove visitors and broadcast leave event
  - Create message handler for position updates (relay to other clients)
  - Create message handler for comment broadcasts
  - Create message handler for comment deletion broadcasts
  - Implement rate limiting for position updates (max 10/second per visitor)
  - Add visitor metadata tracking (ID, name, last position)
  - Deploy Partykit server configuration
  - _Requirements: 16.1, 16.2, 17.5, 18.3_

- [ ] 23. Implement comment API routes

  - Create `GET /api/frames/[id]/comments` to fetch all comments for a frame
  - Create `POST /api/frames/[id]/comments` to create new comment (auth optional)
  - Create `DELETE /api/comments/[id]` to delete comment (owner only)
  - Validate comment length (max 500 characters)
  - Implement rate limiting (max 1 comment per 5 seconds per user)
  - Store author name as "Anonymous Visitor" for guests
  - Store user profile picture for authenticated users
  - Verify museum ownership before allowing comment deletion
  - _Requirements: 17.4, 17.6, 17.7, 17.8, 18.1, 18.2, 18.5_

- [ ] 24. Build Partykit Presence Manager

  - Create Partykit client connection manager
  - Connect to museum room on museum entry using museum ID
  - Implement position broadcast at 10Hz (every 100ms)
  - Send visitor metadata (ID, name, position, rotation) with updates
  - Handle incoming visitor join events and add to Zustand store
  - Handle incoming visitor leave events and remove from Zustand store
  - Handle incoming position update events and update visitor in store
  - Implement automatic reconnection with exponential backoff
  - Display connection status indicator
  - Queue position updates during disconnection
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [ ] 25. Build Visitor Avatar component

  - Create simple 3D mesh for visitor avatar (capsule or humanoid shape)
  - Add color variation for different visitors
  - Display visitor name label above avatar using HTML overlay
  - Implement smooth position interpolation for movement
  - Add rotation to face movement direction
  - Implement LOD: simplified mesh for distant avatars
  - Use instanced rendering for multiple avatars
  - Limit rendering to 50 concurrent avatars
  - Cull avatars outside camera frustum
  - _Requirements: 16.3, 16.4, 16.7_

- [ ] 26. Integrate visitor avatars into museum scene

  - Render Visitor Avatar components for all visitors in Zustand store
  - Update avatar positions in real-time from store updates
  - Remove avatar meshes when visitors leave
  - Display visitor count indicator in UI
  - Optimize avatar rendering performance
  - _Requirements: 16.3, 16.4, 16.5, 16.6_

- [ ] 27. Build Comment Thread component

  - Create scrollable comment list UI component
  - Display comments with profile picture, name, text, and timestamp
  - Show "Anonymous Visitor" for guest comments
  - Add text input field for new comments with character counter (500 max)
  - Implement submit button with loading state
  - Add delete button for museum owners (conditional rendering)
  - Implement optimistic UI updates for new comments
  - Connect to Partykit for real-time comment updates
  - Handle incoming comment broadcasts and update UI
  - Handle incoming comment deletion broadcasts and remove from UI
  - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6, 17.7, 17.8, 18.1, 18.3_

- [ ] 28. Integrate comments into Frame Interaction Modal

  - Add Comment Thread section to filled frame modal state
  - Fetch comments from API when modal opens
  - Handle comment submission: call API, broadcast via Partykit
  - Handle comment deletion: call API, broadcast via Partykit
  - Show loading states during API calls
  - Display error messages for failed operations
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.2, 18.4_

- [ ] 29. Implement performance optimizations

  - Add texture compression for all frame images
  - Implement lazy loading: load textures within 15 units, unload beyond 30 units
  - Use instanced meshes for repeated frame geometries and visitor avatars
  - Implement LOD system for frames and avatars based on distance
  - Enable frustum culling in renderer
  - Limit shadow map resolution on mobile devices
  - Add FPS monitoring and adaptive quality system
  - Reduce rendering quality if FPS drops below 50
  - Use passive event listeners for touch events
  - Implement memory management: limit max 20 textures in memory
  - Throttle Partykit position broadcasts if FPS drops below 30
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 16.2_

- [ ] 30. Add error handling and validation

  - Implement error boundaries for React components
  - Add try-catch blocks for all API calls
  - Display toast notifications for network errors with retry option
  - Validate file uploads (type, size) on client and server
  - Handle authentication errors with redirect to sign-in
  - Implement retry logic for Google Cloud Storage uploads (3 attempts)
  - Handle Google Imagen API rate limits and errors
  - Add timeout handling for long-running operations (30 seconds)
  - Handle Partykit connection errors with reconnection logic
  - Show connection status and gracefully degrade if Partykit unavailable
  - Validate comment length and sanitize content
  - Log errors to monitoring service
  - _Requirements: All requirements - error handling_

- [ ] 31. Implement responsive design and mobile optimizations

  - Ensure UI components are touch-friendly (min 44px touch targets)
  - Test and optimize for iPhone 12 viewport
  - Reduce rendering quality on mobile devices
  - Disable expensive effects (shadows, reflections) on mobile
  - Simplify visitor avatars on mobile (lower poly count)
  - Add loading states for all async operations
  - Implement progressive image loading
  - Test touch joystick responsiveness
  - Verify 60fps performance on iPhone 12 with multiplayer active
  - _Requirements: 3.3, 3.4, 3.5, 15.4, 16.7_

- [ ]\* 32. Write API route tests

  - Write unit tests for museum CRUD operations
  - Write unit tests for frame CRUD operations
  - Write unit tests for comment CRUD operations
  - Write unit tests for image upload and generation
  - Write unit tests for authentication middleware
  - Write integration tests for complete user flows
  - Test public access routes without authentication
  - Test comment moderation and ownership validation
  - Test error handling and validation
  - _Requirements: All API-related requirements_

- [ ]\* 33. Write component tests

  - Write tests for Frame Interaction Modal states and interactions
  - Write tests for Profile Overlay functionality
  - Write tests for Tutorial Modal display and dismissal
  - Write tests for Portal System museum switching
  - Write tests for Comment Thread component
  - Write tests for Visitor Avatar rendering
  - Write tests for Zustand store actions including multiplayer state
  - _Requirements: UI component requirements_

- [ ]\* 34. Write Partykit server tests

  - Write tests for visitor join/leave handling
  - Write tests for position update broadcasting
  - Write tests for comment broadcasting
  - Write tests for rate limiting
  - Test connection/disconnection scenarios
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 17.5, 18.3_

- [ ]\* 35. Set up end-to-end tests

  - Write E2E test for sign in and museum creation flow
  - Write E2E test for image upload and display in 3D
  - Write E2E test for AI image generation
  - Write E2E test for public museum access
  - Write E2E test for frame-specific sharing
  - Write E2E test for museum switching via portal
  - Write E2E test for multiplayer presence (multiple browser tabs)
  - Write E2E test for commenting on images
  - Write E2E test for comment moderation
  - Test mobile navigation and interactions
  - Measure and verify performance benchmarks (FPS, load times)
  - _Requirements: All critical user flows_

- [ ] 36. Deploy and configure production environment

  - Set up Vercel project and connect repository
  - Configure environment variables in Vercel (including Partykit)
  - Set up Neon Postgres production database
  - Run database migrations in production
  - Deploy Partykit server to production
  - Configure Google Cloud Storage bucket for production
  - Set up Google Imagen API access
  - Configure Clerk production instance
  - Set up monitoring and error tracking (Sentry)
  - Test production deployment with real devices
  - Test multiplayer functionality in production
  - _Requirements: All requirements - production readiness_
