# LodgeEase - Lodge Management System

A comprehensive lodge and hotel management system built with Firebase, providing both customer-facing booking capabilities and administrative management tools.

## 🏨 Overview

LodgeEase is a full-featured lodge management system that streamlines hotel operations from customer bookings to administrative management. The system provides a dual-interface approach with separate portals for customers and administrators.

## ✨ Features

### Customer Portal (ClientSide)
- **Room Booking System**: Browse and book available rooms with real-time availability
- **Interactive Homepage**: Modern UI with room showcases and lodge information
- **Payment Processing**: Integrated payment verification and processing
- **Booking Management**: View booking history and manage reservations
- **User Authentication**: Secure login and registration system
- **Mobile Responsive**: Optimized for all device sizes

### Administrative Portal (AdminSide)
- **Dashboard**: Comprehensive overview with analytics and key metrics
- **Room Management**: Add, edit, and manage room inventory
- **Booking Management**: Process bookings, modifications, and cancellations
- **Business Analytics**: Advanced reporting and data visualization
- **User Management**: Role-based access control and user administration
- **Financial Reports**: Revenue tracking and financial analytics
- **Activity Logging**: Comprehensive audit trail of system activities
- **Settings Management**: System configuration and preferences

### Advanced Features
- **Real-time Updates**: Live booking status and availability updates
- **AI Analytics**: Business intelligence and forecasting
- **Email Notifications**: Automated booking confirmations and updates
- **Data Export**: Export reports and analytics data
- **Multi-role Support**: Admin and user role management
- **Security**: Firestore security rules and authentication

## 🏗️ Architecture

### Frontend
- **Client Side**: HTML5, CSS3, JavaScript (ES6+)
- **Admin Side**: Vue.js components with vanilla JavaScript
- **Styling**: TailwindCSS for responsive design
- **UI Components**: Custom components for modular development

### Backend
- **Database**: Google Firestore (NoSQL)
- **Authentication**: Firebase Authentication
- **Cloud Functions**: Node.js serverless functions
- **Storage**: Firebase Storage for file uploads
- **Hosting**: Firebase Hosting with multi-site configuration

### Project Structure
```
LodgeEase/
├── ClientSide/                 # Customer-facing application
│   ├── Homepage/              # Main landing pages
│   ├── Login/                 # Authentication pages
│   ├── Bookings/              # Booking management
│   ├── paymentProcess/        # Payment handling
│   └── components/            # Reusable components
├── AdminSide/                 # Administrative interface
│   ├── Dashboard/             # Admin dashboard
│   ├── Room Management/       # Room inventory management
│   ├── Reports/               # Analytics and reports
│   ├── BusinessAnalytics/     # Business intelligence
│   ├── Settings/              # System configuration
│   └── Login/                 # Admin authentication
├── functions/                 # Firebase Cloud Functions
├── firestore.rules           # Database security rules
├── storage.rules             # Storage security rules
└── firebase.json             # Firebase configuration
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- Firebase CLI
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd LodgeEase/LodgeEase-Latest
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install functions dependencies
cd functions
npm install
cd ..

# Install AdminSide dependencies (if applicable)
cd AdminSide
npm install
cd ..
```

### 3. Firebase Setup
```bash
# Login to Firebase
firebase login

# Initialize Firebase (if not already configured)
firebase init

# Set your Firebase project
firebase use <your-project-id>
```

### 4. Environment Configuration
- Update Firebase configuration in:
  - `ClientSide/firebase-config.js`
  - `AdminSide/firebase-config.js`
  - `ClientSide/appcheck-config.js`
  - `AdminSide/appcheck-config.js`

### 5. Build TailwindCSS
```bash
# Build CSS for development
npm run build:css

# Or for production
npm run build
```

## 🛠️ Development

### Local Development
```bash
# Start TailwindCSS watch mode and server
npm run dev

# Or run components separately:
# Watch TailwindCSS changes
npm run build:css

# Start local server
npm start
```

### Firebase Emulators
```bash
# Start Firebase emulators for local development
firebase emulators:start

# Start only functions emulator
npm run serve
```

### Testing Functions
```bash
cd functions
npm run shell
```

## 📦 Deployment

### Deploy Everything
```bash
firebase deploy
```

### Deploy Specific Components
```bash
# Deploy only hosting
firebase deploy --only hosting

# Deploy only functions
firebase deploy --only functions

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy specific hosting target
firebase deploy --only hosting:client
firebase deploy --only hosting:admin
```

### Hosting Targets
The project uses Firebase multi-site hosting:
- **Client Portal**: `lodgeease` (CustomerSide)
- **Admin Portal**: `admin-lodgeease` (AdminSide)

## 🔧 Configuration

### Firebase Configuration
- **Project ID**: `lms-app-2b903`
- **Client Hosting**: `lodgeease`
- **Admin Hosting**: `admin-lodgeease`

### Security Rules
- Firestore rules implement role-based access control
- Storage rules protect file uploads
- Authentication required for most operations
- Admin-only operations protected

### Environment Variables
Configure in Firebase Functions:
- Email service credentials
- Payment processing keys
- Third-party API keys

## 📊 Database Schema

### Main Collections
- **users**: User accounts and roles
- **rooms**: Room inventory and details
- **bookings**: Reservation records
- **analytics**: Business metrics and reports
- **activityLogs**: System audit trail
- **paymentHistory**: Financial transactions

### Request Collections
- **paymentVerificationRequests**: Payment confirmations
- **modificationRequests**: Booking changes
- **cancellationRequests**: Booking cancellations

## 🔐 Security Features

- Role-based access control (Admin/User)
- Firebase Authentication integration
- Secure Firestore rules
- Input validation and sanitization
- Rate limiting for API calls
- CORS configuration
- HTTPS enforcement

## 🎯 API Endpoints

### Cloud Functions
- User authentication and registration
- Email notifications
- Payment processing
- Data analytics processing
- Report generation

## 📱 Responsive Design

The system is fully responsive and optimized for:
- Desktop computers
- Tablets
- Mobile phones
- Different screen orientations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.

## 🆘 Support

For support and questions:
- Check the documentation in individual component folders
- Review Firebase console for logs and errors
- Examine browser console for frontend issues

## 🔄 Version History

- **v1.0.0**: Initial release with core functionality
  - Customer booking system
  - Administrative dashboard
  - Firebase integration
  - Analytics and reporting

## 🚀 Future Enhancements

- Mobile application
- Advanced AI analytics
- Third-party integrations
- Multi-property support
- Advanced reporting features

---

**Built with ❤️ for efficient lodge management**