# Roadtrip Planner

A modern, React-based roadtrip planning application featuring interactive routing, vehicle cost estimation, and detailed trip summaries.

## Features

-   **Interactive Map**: Powered by Leaflet and OpenStreetMap.
-   **Routing**: Uses OSRM (Open Source Routing Machine) for accurate driving directions.
-   **Vehicle Configuration**: Preset and custom vehicle options for precise fuel cost estimation.
-   **Trip Summary**: Real-time calculation of distance, duration, and fuel costs.
-   **Responsive Design**: Built with Tailwind CSS for mobile and desktop compatibility.

## Tech Stack

-   **React 19**
-   **Vite**
-   **TypeScript**
-   **Tailwind CSS**
-   **Leaflet / React Leaflet**
-   **Lucide React** (Icons)
-   **Radix UI** (Primitives)

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Build for Production**:
    ```bash
    npm run build
    ```

## Project Structure

-   `src/components/Map`: Map visualization logic.
-   `src/components/Trip`: Trip planning (search, location list, summary).
-   `src/components/Vehicle`: Vehicle configuration forms.
-   `src/components/UI`: Reusable UI components.
-   `src/lib`: API services and calculation utilities.
-   `src/types`: TypeScript definitions.

## License

MIT
