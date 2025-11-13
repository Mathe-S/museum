# Implementation Plan

- [x] 1. Set up project structure and dependencies

  - Initialize Next.js 16+ project with App Router and TypeScript
  - Install Three.js, React Three Fiber, and Drei helpers
  - Install tRPC and @trpc/server, @trpc/client, @trpc/react-query, @trpc/next
  - Install TanStack Query (@tanstack/react-query) for data fetching
  - Install Zod for schema validation
  - Install Clerk for authentication
  - Install Drizzle ORM and drizzle-kit for migrations
  - Configure Neon Postgres connection with Drizzle
  - Install Partykit and partysocket for real-time multiplayer
  - Install Zustand for state management
  - Install Tailwind CSS for styling
  - Configure Google Cloud Storage SDK
  - Configure Google Imagen API client
  - Set up environment variables structure (including Partykit and tRPC URLs)
  - _Requirements: 1.1, 1.2, 16.1_

- [x] 2. Set up tRPC infrastructure

  - Create tRPC router configuration in `/server/trpc.ts`
  - Set up tRPC context with Clerk authentication
  - Create protected procedure middleware for authenticated routes
  - Create public procedure for unauthenticated access
  - Set up tRPC API handler at `/app/api/trpc/[trpc]/route.ts`
  - Configure tRPC client provider in root layout with React Query
  - Set up React Query devtools for development
  - _Requirements: All API requirements_

- [x] 3. Configure authentication with Clerk

  - Set up Clerk provider in root layout
  - Configure Google OAuth provider in Clerk dashboard
  - Integrate Clerk with tRPC context for user session
  - Create `auth.callback` tRPC mutation for user profile creation webhook
  - Store user profile picture URL from Google in database
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Set up database schema and migrations

  - Define Drizzle schema for users, museums, frames, and comments tables
  - Create initial migration using drizzle-kit generate
  - Add indexes for userId, shareToken, museumId, frameId, and createdAt fields
  - Run migration using drizzle-kit push or migrate
  - Create seed script with test data for development
  - _Requirements: 1.2, 9.1, 9.2, 9.3, 11.1, 12.2, 17.4_

- [x] 5. Implement museum tRPC router

  - Create museum router at `/server/routers/museum.ts`
  - Implement `museum.list` query to list user's museums
  - Implement `museum.create` mutation to create new museum with default structure
  - Implement `museum.getById` query to fetch museum details with frames
  - Implement `museum.update` mutation to update museum name and public status
  - Implement `museum.delete` mutation to soft delete museum
  - Implement `museum.generateShareLink` mutation to generate unique share token
  - Use protected procedure middleware for all routes
  - Define Zod schemas for input validation
  - _Requirements: 11.1, 11.3, 12.1, 12.2, 12.3_

- [x] 6. Implement frame tRPC router

  - Create frame router at `/server/routers/frame.ts`
  - Implement `frame.listByMuseum` query to list all frames in museum
  - Implement `frame.create` mutation to create or update frame with image
  - Implement `frame.delete` mutation to remove frame image
  - Implement `frame.generateShareLink` mutation to generate frame-specific share token
  - Validate frame position limits (max 30 frames per museum) in Zod schema
  - Use protected procedure middleware for all routes
  - _Requirements: 4.5, 6.5, 8.4, 8.5, 13.2_

- [x] 7. Implement image tRPC router

  - Create image router at `/server/routers/image.ts`
  - Implement `image.upload` mutation for image uploads
  - Integrate Google Cloud Storage SDK for file storage
  - Validate file type (JPEG, PNG, WebP) and size (max 3MB) with Zod
  - Generate unique filenames using cuid
  - Compress and optimize images to WebP format
  - Generate multiple sizes (thumbnail, medium, full) for performance
  - Implement `image.getSignedUrl` query to return signed URLs with expiration
  - Extract theme colors from uploaded images using color-thief library
  - _Requirements: 6.4, 6.5, 9.2, 9.3, 15.1_

- [ ] 8. Implement AI image generation in image router

  - Add `image.generate` mutation to image router
  - Integrate Google Imagen API client
  - Accept prompt text and style preset parameters with Zod validation
  - Map style presets (Van Gogh, Impressionist) to Imagen parameters
  - Handle API rate limits and errors gracefully
  - Store generated images in Google Cloud Storage
  - Extract theme colors from generated images
  - _Requirements: 7.4, 7.5, 7.6, 9.3_

- [ ] 9. Implement public tRPC router

  - Create public router at `/server/routers/public.ts`
  - Implement `public.getMuseumByShareToken` query for public museum access
  - Implement `public.getFrameByShareToken` query for frame-specific links
  - Return museum data without authentication requirement (use public procedure)
  - Include spawn position for frame-specific shares
  - Implement rate limiting middleware for public procedures
  - _Requirements: 12.4, 13.3, 14.1_

- [ ] 10. Create Zustand store for global state

  - Define MuseumStore interface with current museum, frames, and UI state
  - Implement actions for setting museum, updating frames, deleting frames
  - Add theme mode toggle action
  - Add selected frame state management
  - Implement tutorial dismissal state
  - Add multiplayer state: visitors map and visitor count
  - Implement visitor management actions (add, update, remove visitors)
  - Note: React Query handles server state, Zustand for 3D/UI state only
  - _Requirements: 10.4, 2.4, 16.2, 16.3, 16.4_

- [ ] 11. Build Museum Scene Manager component

  - Initialize Three.js scene with WebGLRenderer
  - Configure renderer settings for performance (powerPreference, pixelRatio)
  - Set up perspective camera with appropriate FOV
  - Implement day theme lighting (directional light, ambient light)
  - Implement night theme lighting (reduced intensity, moonlight effect)
  - Add theme toggle listener to switch lighting configurations
  - Enable frustum culling and occlusion
  - _Requirements: 10.1, 10.2, 10.3, 15.4_

- [ ] 12. Build Museum Layout Generator

  - Create function to generate Main Hall geometry (walls, floor, ceiling)
  - Position 9 frame entities in 3x3 grid on back wall of Main Hall
  - Create function to generate Extendable Hall corridor
  - Implement alternating left-right frame placement algorithm
  - Add new frame position when previous frame is filled
  - Place portal entity at end of Extendable Hall
  - Generate collision boundaries for walls
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.4_

- [ ] 13. Build Frame Entity component

  - Create frame mesh with picture frame geometry
  - Implement texture loading system with lazy loading (load within 15 units)
  - Add LOD system (high-res < 10 units, low-res > 10 units)
  - Implement raycasting for hover detection
  - Display circle indicator for empty frames on hover
  - Display highlight indicator for filled frames on hover
  - Remove indicators when camera moves away (< 100ms)
  - Compress textures to WebP and generate mipmaps
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 15.1, 15.3_

- [ ] 14. Implement desktop navigation controls

  - Integrate PointerLockControls for first-person camera
  - Implement WASD keyboard movement with 5 units/second speed
  - Implement mouse look for camera rotation
  - Add collision detection with walls and boundaries
  - Lock pointer on canvas click, unlock on ESC
  - _Requirements: 3.1, 3.2_

- [ ] 15. Implement mobile navigation controls

  - Add virtual joystick component for movement (bottom-left position)
  - Implement touch drag for camera rotation
  - Set movement speed to 3 units/second for mobile
  - Disable pinch-to-zoom
  - Add collision detection for mobile movement
  - _Requirements: 3.3, 3.4_

- [ ] 16. Build Frame Interaction Modal component

  - Create modal UI with backdrop and close button
  - Implement empty frame state: Upload, Camera Capture, AI Generate sections
  - Add file input for device upload with type and size validation
  - Add camera capture button with device camera API integration
  - Add AI generation form with prompt input and style dropdown
  - Implement filled frame state: View Details, Edit, Delete, Share buttons
  - Display image, description, and theme colors in details view
  - Pause 3D navigation when modal is open
  - Close modal on ESC key or outside click
  - Use tRPC mutations for all actions (upload, generate, delete, share)
  - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4_

- [ ] 17. Implement frame interaction logic

  - Add click event listener to Frame Entity components
  - Open Frame Interaction Modal with appropriate state (empty/filled)
  - Handle image upload: use `image.upload` mutation, then `frame.create` mutation
  - Handle camera capture: access device camera, capture image, upload via tRPC
  - Handle AI generation: use `image.generate` mutation, then `frame.create` mutation
  - Handle delete: use `frame.delete` mutation, React Query auto-invalidates cache
  - Handle share: use `frame.generateShareLink` mutation, copy link to clipboard
  - Implement optimistic updates for better UX
  - _Requirements: 6.4, 6.5, 6.6, 7.4, 7.5, 7.6, 8.5, 13.2_

- [ ] 18. Build Profile Overlay component

  - Create overlay UI with user profile picture from Google
  - Display current museum name
  - Add public/private toggle switch using `museum.update` mutation
  - Generate and display share link using `museum.generateShareLink` mutation
  - Add copy-to-clipboard button for share link
  - Display list of user's museums using `museum.list` query
  - Add "Create New Museum" button with `museum.create` mutation
  - Implement optimistic updates for toggle and creation
  - _Requirements: 1.4, 11.2, 12.1, 12.2, 12.3_

- [ ] 19. Build Portal System component

  - Create portal 3D mesh at end of Extendable Hall
  - Add collision detection zone around portal
  - Display museum selection UI when user enters portal zone
  - Fetch user's museums using `museum.list` query
  - Implement museum selection handler
  - Create fade-to-black transition effect
  - Load new museum scene using `museum.getById` query
  - Spawn user at entrance of new museum
  - _Requirements: 11.4, 11.5, 11.6_

- [ ] 20. Build Tutorial Modal component

  - Create modal with welcome message and instructions
  - Add sections for navigation (WASD/joystick), frame interaction, AI generation
  - Include images or GIFs demonstrating features
  - Add dismiss button
  - Store dismissal state in localStorage
  - Update dismissal state in database via tRPC mutation
  - Show tutorial only on first visit per user
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 21. Implement public museum access

  - Create public museum page at `/museum/[shareToken]`
  - Fetch museum data using `public.getMuseumByShareToken` query (no auth)
  - Load 3D scene with all frames
  - Enable navigation controls for guest visitors
  - Disable frame editing/uploading for guests
  - Show view-only details when guests click frames
  - _Requirements: 12.4, 12.5, 14.1, 14.2, 14.3, 14.4_

- [ ] 22. Implement frame-specific sharing

  - Create frame share page at `/frame/[shareToken]`
  - Fetch frame and museum data using `public.getFrameByShareToken` query
  - Load museum scene and position camera in front of shared frame
  - Allow guest visitor to navigate freely after spawning
  - _Requirements: 13.3, 13.4_

- [ ] 23. Set up Partykit server for multiplayer

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

- [ ] 24. Implement comment tRPC router

  - Create comment router at `/server/routers/comment.ts`
  - Implement `comment.listByFrame` query to fetch all comments for a frame
  - Implement `comment.create` mutation to create new comment (auth optional)
  - Implement `comment.delete` mutation to delete comment (owner only)
  - Validate comment length (max 500 characters) with Zod schema
  - Implement rate limiting middleware (max 1 comment per 5 seconds per user)
  - Store author name as "Anonymous Visitor" for guests
  - Store user profile picture for authenticated users
  - Verify museum ownership before allowing comment deletion
  - _Requirements: 17.4, 17.6, 17.7, 17.8, 18.1, 18.2, 18.5_

- [ ] 25. Build Partykit Presence Manager

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

- [ ] 26. Build Visitor Avatar component

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

- [ ] 27. Integrate visitor avatars into museum scene

  - Render Visitor Avatar components for all visitors in Zustand store
  - Update avatar positions in real-time from store updates
  - Remove avatar meshes when visitors leave
  - Display visitor count indicator in UI
  - Optimize avatar rendering performance
  - _Requirements: 16.3, 16.4, 16.5, 16.6_

- [ ] 28. Build Comment Thread component

  - Create scrollable comment list UI component
  - Fetch comments using `comment.listByFrame` query
  - Display comments with profile picture, name, text, and timestamp
  - Show "Anonymous Visitor" for guest comments
  - Add text input field for new comments with character counter (500 max)
  - Implement submit button using `comment.create` mutation
  - Add delete button using `comment.delete` mutation (conditional rendering)
  - Implement optimistic UI updates for new comments with React Query
  - Connect to Partykit for real-time comment updates
  - Handle incoming comment broadcasts and invalidate React Query cache
  - Handle incoming comment deletion broadcasts and update cache
  - _Requirements: 17.1, 17.2, 17.3, 17.5, 17.6, 17.7, 17.8, 18.1, 18.3_

- [ ] 29. Integrate comments into Frame Interaction Modal

  - Add Comment Thread section to filled frame modal state
  - Fetch comments using `comment.listByFrame` query when modal opens
  - Handle comment submission using `comment.create` mutation, broadcast via Partykit
  - Handle comment deletion using `comment.delete` mutation, broadcast via Partykit
  - Show loading states during tRPC mutations
  - Display error messages for failed operations
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 18.2, 18.4_

- [ ] 30. Implement performance optimizations

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

- [ ] 31. Add error handling and validation

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

- [ ] 32. Implement responsive design and mobile optimizations

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

- [ ]\* 33. Write tRPC router tests

  - Write unit tests for museum router procedures
  - Write unit tests for frame router procedures
  - Write unit tests for comment router procedures
  - Write unit tests for image upload and generation procedures
  - Write unit tests for tRPC middleware (authentication, rate limiting)
  - Write integration tests for complete tRPC workflows
  - Test public router procedures without authentication
  - Test comment moderation and ownership validation
  - Test Zod schema validation and error handling
  - _Requirements: All API-related requirements_

- [ ]\* 34. Write component tests

  - Write tests for Frame Interaction Modal states and interactions
  - Write tests for Profile Overlay functionality
  - Write tests for Tutorial Modal display and dismissal
  - Write tests for Portal System museum switching
  - Write tests for Comment Thread component
  - Write tests for Visitor Avatar rendering
  - Write tests for Zustand store actions including multiplayer state
  - _Requirements: UI component requirements_

- [ ]\* 35. Write Partykit server tests

  - Write tests for visitor join/leave handling
  - Write tests for position update broadcasting
  - Write tests for comment broadcasting
  - Write tests for rate limiting
  - Test connection/disconnection scenarios
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 17.5, 18.3_

- [ ]\* 36. Set up end-to-end tests

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

- [ ] 37. Deploy and configure production environment

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
