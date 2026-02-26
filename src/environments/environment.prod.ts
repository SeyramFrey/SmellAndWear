export const environment = {
  production: true,
  defaultauth: 'fakebackend',
  siteUrl: 'https://smellandwear.com',
  supabase: {
    url: 'https://ciiqdruaphzxratjpqzk.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpaXFkcnVhcGh6eHJhdGpwcXprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTc0OTAsImV4cCI6MjA2MDEzMzQ5MH0.T3tHsc0iv2DH1Kn315r2KQEpEBSO6Uvu1tK5ubu6YxU',
    /** Enable image transformation (WEBP, resize). Requires Supabase Pro Plan. Set to false for free tier. */
    imageTransformationEnabled: true
  },
  firebaseConfig: {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
  }
};