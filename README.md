# FamilyTree - Collaborative Family Tree Application

A modern, self-serve web application for documenting and preserving family history. Built with Next.js, TypeScript, and PostgreSQL.

## Features

### Core Features
- **Visual Family Tree**: Interactive tree visualization with expandable branches, zoom/pan controls, and responsive design
- **Person Management**: Add family members with photos, biographies, interesting facts, and contact information
- **Collaborative Editing**: Family members can contribute to building the tree together
- **Approval Workflow**: Changes require approval from 2 family members to maintain data integrity
- **Correction Requests**: Submit corrections for inaccurate information
- **Messaging System**: Direct messaging between family members
- **Notifications**: Real-time notifications for approvals, messages, and new additions

### Authentication
- Email and password registration/login
- Phone number authentication (SMS OTP ready)
- Role-based access control (Admin, Member, Viewer)

### Privacy & Security
- Public viewing with private editing (authenticated users only)
- Optional privacy settings for contact information
- Input validation and sanitization
- Secure session management

## Tech Stack

- **Frontend**: Next.js 14+, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes (Serverless)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Styling**: Tailwind CSS with custom design system
- **Icons**: Lucide React
- **Forms**: React Hook Form with Zod validation

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository:
```bash
cd family-tree-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/family_tree"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
family-tree-app/
├── app/
│   ├── (auth)/           # Authentication pages (login, register)
│   ├── (main)/           # Main application pages
│   │   ├── tree/         # Family tree visualization
│   │   ├── person/[id]/  # Person detail pages
│   │   ├── add-person/   # Add new person form
│   │   ├── approvals/    # Approval queue
│   │   ├── corrections/  # Correction requests
│   │   ├── messages/     # Messaging interface
│   │   └── profile/      # User profile settings
│   └── api/              # API routes
├── components/
│   ├── tree/             # Tree visualization components
│   ├── person/           # Person-related components
│   ├── approval/         # Approval system components
│   ├── messages/         # Messaging components
│   ├── shared/           # Shared components (navbar, etc.)
│   └── ui/               # Base UI components
├── lib/
│   ├── db.ts             # Database client
│   ├── auth.ts           # Auth configuration
│   ├── tree-utils.ts     # Tree algorithms
│   └── validators.ts     # Form validation schemas
├── prisma/
│   └── schema.prisma     # Database schema
└── types/
    └── index.ts          # TypeScript type definitions
```

## Database Schema

### Core Tables
- `users` - User accounts and authentication
- `persons` - Family members in the tree
- `relationships` - Family connections (parent-child, spouse)
- `person_images` - Photos associated with persons
- `pending_changes` - Changes awaiting approval
- `approvals` - Individual approval votes
- `correction_requests` - Submitted corrections
- `messages` - Direct messages between users
- `notifications` - User notifications
- `activities` - Activity feed entries

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth.js handlers

### Persons
- `GET /api/persons` - List/search persons
- `POST /api/persons` - Create new person
- `GET /api/persons/[id]` - Get person details
- `PUT /api/persons/[id]` - Update person
- `DELETE /api/persons/[id]` - Delete person (admin only)

### Relationships
- `GET /api/relationships` - Get relationships
- `POST /api/relationships` - Create relationship

### Tree
- `GET /api/tree` - Get family tree data

### Approvals
- `GET /api/approvals` - Get pending approvals
- `POST /api/approvals/[id]` - Approve/reject change

### Corrections
- `GET /api/corrections` - Get correction requests
- `POST /api/corrections` - Submit correction
- `POST /api/corrections/[id]` - Process correction

### Messages
- `GET /api/messages` - Get messages/conversations
- `POST /api/messages` - Send message

### Notifications
- `GET /api/notifications` - Get notifications
- `POST /api/notifications` - Mark as read

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Self-Hosted
1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Configuration

### Environment Variables
| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `NEXTAUTH_URL` | Application URL | Yes |
| `NEXTAUTH_SECRET` | JWT secret key | Yes |
| `EMAIL_SERVER_*` | Email configuration | No |
| `TWILIO_*` | SMS configuration | No |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token | No |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your family!

## Support

For questions or issues, please open a GitHub issue.
