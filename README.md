# SecureChat - End-to-End Encrypted Messaging App

SecureChat is a modern messaging platform with enhanced security features, focusing on privacy, reliability, and a seamless user experience across web and mobile platforms.

## 🔐 Key Security Features

- **End-to-End Encryption (E2EE)**: All messages and media files are encrypted on the sender's device and can only be decrypted by the intended recipient
- **Local Key Storage**: Encryption keys are generated and stored locally on user devices
- **Zero-Knowledge Architecture**: Your encryption keys are never sent to our servers
- **Perfect Forward Secrecy**: Message session keys rotate regularly
- **Encrypted File Sharing**: Send files up to 100MB with the same E2EE protection as messages
- **Self-Destructing Messages**: Set messages to automatically delete after a specified time
- **Screen Security**: Option to block screenshots and app content in recent apps
- **Secure Backup**: Encrypted cloud backups with user-defined password

## 🚀 Innovative Features

- **Instant Voice Messages**: Push-to-talk voice messaging with transcription
- **Secure Group Chats**: Create groups with the same E2EE protection as direct messages
- **WebRTC Video/Audio Calls**: Encrypted peer-to-peer calls
- **Offline Messaging**: Queue messages to send when connectivity returns
- **Multi-Device Sync**: Use the same account across multiple devices
- **Local Contact Discovery**: Find contacts without uploading your address book
- **Read Receipts**: See when messages are delivered and read
- **Disappearing Media**: Send photos and videos that can only be viewed once
- **Verification Codes**: Verify contact identity with QR codes or numeric codes

## 🛠️ Technology Stack

- **Frontend**: React (Web), React Native (Mobile)
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Hosting**: Vercel for web deployment
- **APIs**:
  - WebRTC for real-time communication
  - Web Crypto API for encryption
  - Service Workers for offline functionality
  - Push Notifications API
- **DevOps**: GitHub Actions for CI/CD
- **Analytics**: Privacy-focused anonymous analytics

## 📱 Supported Platforms

- **Web**: Modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile**: Android and iOS (via React Native)
- **Desktop**: Progressive Web App (PWA) installable on Windows, macOS, and Linux

## 🔧 Setup & Development

### Prerequisites

- Node.js v16+
- npm or yarn
- Git
- Supabase account

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/secure-messaging-app.git
   cd secure-messaging-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your Supabase credentials:
   ```
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run the development server:
   ```bash
   npm start
   ```

### Database Setup

1. Run the initial schema migration:
   ```bash
   npx supabase db push
   ```

2. (Optional) Seed the database with sample data:
   ```bash
   npx supabase db execute ./supabase/seed/sample_data.sql
   ```

### Building for Production

```bash
npm run build
```

### Deploying to Vercel

```bash
vercel --prod
```

## 📊 Database Schema

The app uses the following primary tables in Supabase:

- **users**: User accounts and profiles
- **user_keys**: Public keys for E2EE
- **contacts**: User contacts and relationships
- **conversations**: Chat conversations (1-to-1 and groups)
- **messages**: Individual messages within conversations
- **attachments**: Files and media shared in conversations
- **user_status**: Online/offline status and last seen timestamps

## 📝 API Documentation

### Authentication API

- `POST /auth/register` - Create new user account
- `POST /auth/login` - Authenticate user
- `POST /auth/refresh` - Refresh authentication token
- `POST /auth/logout` - Logout user

### Messages API

- `GET /messages/:conversationId` - Get messages for a conversation
- `POST /messages` - Send a new message
- `DELETE /messages/:id` - Delete a message

### Files API

- `POST /files/upload` - Upload encrypted file
- `GET /files/:id` - Download encrypted file

## 🔜 Roadmap

- [ ] Voice and video calls
- [ ] Message reactions
- [ ] Message searching
- [ ] Verified business accounts
- [ ] Desktop apps (Electron)
- [ ] Integration with hardware security keys
- [ ] Decentralized contact verification
- [ ] Message threading
- [ ] Automated E2E testing

## 🤝 Contributing

Contributions are welcome! Please check out our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

If you have any questions, please reach out to the project maintainers.

---

⚠️ **Security Note**: While this app implements strong encryption protocols, no system is 100% secure. We regularly conduct security audits and welcome responsible disclosure of potential vulnerabilities.
