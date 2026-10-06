# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Backend: curriculum generation operations

- **Generation runs in-process.** Each project's learning plan is generated in a FastAPI `BackgroundTask`. A backend restart, crash or `--reload` during generation loses that task, and nothing resumes it. The project keeps reading "generating" until its 120-second lease expires, then reads "failed", and the user can press **Try again**. The app keeps polling for 150 seconds, longer than the lease, so it picks up that "failed" state on its own.
- **Logs.** The backend logs one `Generation claimed` line (`trigger=create` or `trigger=retry`) and one `Generation finished` line per attempt. These lines contain ids, provider, model, outcome and `duration_ms` only. They never include prompts, project text, provider responses or keys.
- **Deploying over pre-Phase 3.3 data.** The legacy-status migration runs at startup. Retire every instance running older code before or as the new version starts: an old instance can keep writing legacy documents. Restarting the new version migrates any it wrote in the meantime.
- **Live database checks (opt-in).** Run `MONGO_LIVE_TEST=1 pytest tests/test_mongo_generation_live.py` from `backend/`. The test uses a uniquely named temporary database and drops it afterwards. It never reads or writes application data.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
