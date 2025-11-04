# App Icons Database

A modern web application for browsing and discovering application logos with advanced filtering capabilities.

## Features

- **Backend-powered filtering**: Category filtering is now handled by Supabase for optimal performance
- **Dynamic categories**: Categories are loaded from the database and can be updated without code changes
- **Color-based filtering**: Filter apps by dominant color extracted from app icons
- **Search functionality**: Search through the app database with real-time results
- **Responsive design**: Modern UI that works on all devices
- **Performance optimized**: Only fetches filtered results from the backend

## Architecture

### Backend (Supabase)
- **Categories table**: Stores app categories with display names
- **Apps table**: Enhanced with category field and foreign key constraints
- **Database functions**: Efficient category-based queries using Supabase's query builder
- **Indexes**: Optimized database performance with strategic indexing

### Frontend (React + TypeScript)
- **Dynamic category loading**: Categories fetched from database on app initialization
- **Real-time filtering**: Category changes trigger immediate backend queries
- **Search integration**: Search respects current category filters
- **Performance**: Eliminated client-side filtering for better scalability

## Database Schema

```sql
-- Categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL
);

-- Enhanced apps table
CREATE TABLE apps (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  app_store_id VARCHAR(50) NOT NULL,
  category VARCHAR(50) REFERENCES categories(name),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Setup

1. **Database Migration**: Run the migration script in your Supabase SQL editor:
   ```sql
   -- Run migrate-categories.sql in Supabase
   ```

2. **Data Source**: The app now reads data from a public Google Sheet using the gviz JSON endpoint. No Supabase credentials are required.

3. **Install Dependencies**: 
   ```bash
   npm install
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## Performance Improvements

### Before (Frontend Filtering)
- All apps fetched from database
- Client-side category mapping using complex keyword matching
- Performance degraded with large datasets
- Inconsistent categorization logic

### After (Backend Filtering)
- Only filtered results fetched from database
- Database-level category queries with proper indexing
- Consistent performance regardless of dataset size
- Centralized categorization logic

## API Endpoints

- `GET /apps` - Fetch all apps (with optional category filtering)
- `GET /apps?category=productivity` - Fetch apps by category
- `GET /categories` - Fetch all available categories
- `POST /apps` - Add new app to database
- `PUT /apps/:id` - Update existing app
- `DELETE /apps/:id` - Delete app from database

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Built with love in Bordeaux by Hugo Kestali 2025
