# HRHome

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.0.8.

## Development server

In a terminal at the repository root, start the Django backend on port 8080. See the [backend setup guide](../Backend/README.md) for Docker and Colima setup.

```bash
docker-compose -f Backend/compose.yaml up -d
```

From the repository root, install the frontend dependencies on first setup and start Angular.

```bash
cd Frontend
npm ci
npm start -- --host 127.0.0.1 --port 4200
```

Keep the Angular process running and open the [local login page](http://127.0.0.1:4200/login) in your browser. The development server automatically reloads when source files change.

Angular forwards `/api/` requests to Django at `http://127.0.0.1:8080` through [proxy.conf.json](proxy.conf.json). In another terminal, verify that the frontend can reach Django through the proxy. A successful request returns JSON containing a `csrfToken`.

```bash
curl -fsS http://127.0.0.1:4200/api/auth/csrf/
```

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
