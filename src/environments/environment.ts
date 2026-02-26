// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  defaultauth: 'fakebackend',
  siteUrl: 'http://localhost:4200',
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
