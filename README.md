# bullshitin.com

Bullshitin.com is a web application that allows users to submit and vote on LinkedIn posts. The application is built using Next.js and TypeScript.

## Features

- Submit new posts
- Vote on posts
- View posts
- View top posts

## Tech Stack

- Next.js
- TypeScript
- Tailwind CSS
- Cheerio
- Franc

### Backend Setup (Supabase)

This project uses Supabase as its backend for storing and managing posts. To set up your local environment to work with Supabase, follow these steps:

1.  **Create a Supabase Project:**

    - Go to [Supabase.io](https://supabase.io/) and create a new account or log in.
    - Create a new project. You can use the free tier.

2.  **Set Up Environment Variables:**

    - In your Supabase project dashboard, go to Project Settings (the gear icon) > API.
    - You'll find your Project URL and `anon` public API key.
    - Create a new file named `.env.local` in the root of this project.
    - Add your Supabase credentials to `.env.local` like this:
      ```env
      SUPABASE_URL=YOUR_PROJECT_URL
      SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
      ```
      Replace `YOUR_PROJECT_URL` and `YOUR_ANON_PUBLIC_KEY` with your actual values.

3.  **Create the `posts` Table:**

    - In your Supabase project dashboard, go to the SQL Editor (icon that looks like `</> SQL`).
    - Click "New query" and paste the following SQL schema to create the `posts` table. Then click "RUN".
      ```sql
      CREATE TABLE public.posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
        url TEXT NOT NULL UNIQUE,
        title TEXT,
        content TEXT,
        upvotes INTEGER DEFAULT 0 NOT NULL,
        language TEXT
      );
      ```

4.  **Enable Row Level Security (RLS) and Set Policies:**

    - It's crucial for security to enable RLS.
    - In the SQL Editor, run the following command to enable RLS on the `posts` table:
      ```sql
      ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
      ```

5.  **Create SQL Functions for Voting:**

    - The application uses PostgreSQL functions to handle upvotes and downvotes atomically.
    - In the SQL Editor, run the following SQL commands to create these functions. Make sure to run them one by one or as a single batch.

      - `increment_upvotes` function:

        ```sql
        CREATE OR REPLACE FUNCTION increment_upvotes(post_id_to_update uuid)
        RETURNS TABLE(id uuid, created_at timestamptz, url text, title text, content text, upvotes integer, language text)
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          UPDATE public.posts
          SET upvotes = posts.upvotes + 1
          WHERE posts.id = post_id_to_update;

          RETURN QUERY
          SELECT p.id, p.created_at, p.url, p.title, p.content, p.upvotes, p.language
          FROM public.posts p
          WHERE p.id = post_id_to_update;
        END;
        $$;
        ```

      - `decrement_upvotes` function:

        ```sql
        CREATE OR REPLACE FUNCTION decrement_upvotes(post_id_to_update uuid)
        RETURNS TABLE(id uuid, created_at timestamptz, url text, title text, content text, upvotes integer, language text)
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          UPDATE public.posts
          SET upvotes = posts.upvotes - 1
          WHERE posts.id = post_id_to_update;

          RETURN QUERY
          SELECT p.id, p.created_at, p.url, p.title, p.content, p.upvotes, p.language
          FROM public.posts p
          WHERE p.id = post_id_to_update;
        END;
        $$;
        ```

Once these steps are completed, your Supabase backend will be ready for the application.

## Getting Started

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## License

MIT
