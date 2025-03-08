-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  phone_number TEXT,
  email TEXT NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Public encryption keys for E2EE
CREATE TABLE public.user_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  public_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, public_key)
);

-- RLS Policies for user_keys
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public keys are viewable by everyone"
  ON public.user_keys FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own public key"
  ON public.user_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- User Contacts
CREATE TABLE public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  contact_user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  blocked BOOLEAN DEFAULT false,
  favorite BOOLEAN DEFAULT false,
  UNIQUE(user_id, contact_user_id)
);

-- RLS Policies for contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can modify their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- Conversations (1-to-1 and group chats)
CREATE TABLE public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT, -- Only for group chats
  is_group BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies for conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Conversation Members (for both 1-to-1 and group conversations)
CREATE TABLE public.conversation_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT DEFAULT 'member', -- 'admin', 'member'
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  left_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, user_id)
);

-- RLS Policies for conversation_members
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view conversations they're part of"
  ON public.conversation_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Conversation creators can add members"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    )
  );

-- Messages
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) NOT NULL,
  sender_id UUID REFERENCES auth.users(id) NOT NULL,
  content TEXT,
  reply_to UUID REFERENCES public.messages(id),
  is_edited BOOLEAN DEFAULT false,
  is_deleted BOOLEAN DEFAULT false,
  read_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- RLS Policies for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in conversations they're part of"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_id
      AND cm.user_id = auth.uid()
      AND cm.left_at IS NULL
    )
  );

CREATE POLICY "Users can send messages to conversations they're part of"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_id
      AND cm.user_id = auth.uid()
      AND cm.left_at IS NULL
    )
  );

CREATE POLICY "Users can update their own messages"
  ON public.messages FOR UPDATE
  USING (
    sender_id = auth.uid() AND
    is_deleted = false
  );

-- Message Attachments (files, images, etc.)
CREATE TABLE public.attachments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  encryption_metadata JSONB NOT NULL,
  thumbnail_url TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies for attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments in conversations they're part of"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON m.conversation_id = cm.conversation_id
      WHERE m.id = message_id
      AND cm.user_id = auth.uid()
      AND cm.left_at IS NULL
    )
  );

-- User Status and Presence
CREATE TABLE public.user_status (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  device_info JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies for user_status
ALTER TABLE public.user_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User status is visible to contacts"
  ON public.user_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE (c.user_id = auth.uid() AND c.contact_user_id = user_id)
      OR (c.contact_user_id = auth.uid() AND c.user_id = user_id)
    )
  );

CREATE POLICY "Users can update their own status"
  ON public.user_status FOR UPDATE
  USING (auth.uid() = user_id);

-- Push Notification Tokens
CREATE TABLE public.push_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  token TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, device_id)
);

-- RLS Policies for push_tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
  ON public.push_tokens FOR ALL
  USING (auth.uid() = user_id);

-- User Settings
CREATE TABLE public.user_settings (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  theme TEXT DEFAULT 'system',
  notifications_enabled BOOLEAN DEFAULT true,
  message_preview_enabled BOOLEAN DEFAULT true,
  read_receipts_enabled BOOLEAN DEFAULT true,
  typing_indicators_enabled BOOLEAN DEFAULT true,
  last_active_status_enabled BOOLEAN DEFAULT true,
  media_auto_download TEXT DEFAULT 'wifi',
  language TEXT DEFAULT 'en',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS Policies for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Channel triggers for realtime functionality
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_message',
    json_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id,
      'created_at', NEW.created_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_new_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();

-- Real-time status updates
CREATE OR REPLACE FUNCTION notify_user_status_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'user_status',
    json_build_object(
      'user_id', NEW.user_id,
      'is_online', NEW.is_online,
      'last_seen', NEW.last_seen
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_status_change
AFTER UPDATE ON public.user_status
FOR EACH ROW
WHEN (OLD.is_online IS DISTINCT FROM NEW.is_online)
EXECUTE FUNCTION notify_user_status_change();

-- Indexes for performance
CREATE INDEX idx_messages_conversation_id ON public.messages (conversation_id, created_at DESC);
CREATE INDEX idx_conversation_members_user_id ON public.conversation_members (user_id);
CREATE INDEX idx_conversation_members_conversation_id ON public.conversation_members (conversation_id);
CREATE INDEX idx_contacts_user_id ON public.contacts (user_id);
CREATE INDEX idx_contacts_contact_user_id ON public.contacts (contact_user_id);
CREATE INDEX idx_attachments_message_id ON public.attachments (message_id);
