# Orbit architecture

Orbit is a browser-based link map. It runs from `index.html` on disk or through a local Python server. The browser owns personal edits, while project files supply the default maps.

Use the [architecture update prompt](architecture-update.md) when a change affects runtime behavior, source layers, the map model, or the way Orbit loads and saves data.

## Runtime and integrations

Either launch path loads the same page and committed JavaScript bundle. The local server also serves a team map when configured and handles link checks. Orbit opens web destinations in the browser. For Remote Desktop, it can download an `.rdp` file or hand off an `orbit-rdp://` URL to the installed Windows helper, which invokes Remote Desktop Connection.

```mermaid
---
config:
  # Compared with ELK, Dagre keeps the runtime diagram shorter.
  layout: dagre
  # Use a light palette inside the backing group.
  theme: base
  themeVariables:
    # Keep text and arrows legible on the light backing.
    primaryTextColor: "#172033"
    lineColor: "#475569"
---
%% Show runtime entry points and external boundaries.
flowchart TB
  subgraph SG_CANVAS[" "]
    direction TB
    LOCAL_FILES["Local files"]
    LOOPBACK_SERVER["serve.py on loopback"]
    ORBIT_PAGE["Orbit page in the browser"]
    BROWSER_STORAGE["Browser storage"]
    WEB_DESTINATION["Web destination"]
    RDP_DOWNLOAD["Downloaded .rdp file"]
    RDP_HELPER["Windows RDP helper"]

    LOCAL_FILES -->|"Open index.html directly"| ORBIT_PAGE
    LOOPBACK_SERVER <-->|"HTTP: page, JSON, and link checks"| ORBIT_PAGE
    ORBIT_PAGE <-->|"Read and save personal data"| BROWSER_STORAGE
    ORBIT_PAGE -->|"Open URL"| WEB_DESTINATION
    ORBIT_PAGE -->|"Download mode"| RDP_DOWNLOAD
    ORBIT_PAGE -->|"Client mode"| RDP_HELPER
  end

  classDef groupCanvas fill:white,stroke:none
  class SG_CANVAS groupCanvas
```

The release archive includes the browser assets, generated data, Python scripts, and Windows helper. See the [page entry point](../index.html), [local server](../serve.py), [RDP launch service](../src/services/rdp-launch.js), and [release contents](RELEASING.md#what-goes-in-the-zip).

## Source layers and build

Source files may import from their own layer or any lower layer. The layer check rejects upward imports and cycles. In the diagram, the vertical connections show layer order. The build starts at `src/app/main.js` and emits `orbit.js` as a plain browser script.

```mermaid
---
config:
  # ELK keeps the same layer order as Dagre with less vertical space.
  layout: elk
  # Use a light palette inside the backing group.
  theme: base
  themeVariables:
    # Keep text and connections legible on the light backing.
    primaryTextColor: "#172033"
    lineColor: "#475569"
---
%% Show source layer order and the release build path.
flowchart TB
  subgraph SG_CANVAS[" "]
    direction TB
    APP["app · startup"]
    UI["ui · views and interaction"]
    SERVICES["services · external I/O"]
    STATE["state · map store and persistence"]
    CORE["core · schema and pure rules"]
    BUILD["esbuild · release build"]
    BUNDLE["orbit.js · committed bundle"]

    APP --- UI
    UI --- SERVICES
    SERVICES --- STATE
    STATE --- CORE
    APP -->|"Entry point and its imports"| BUILD
    BUILD -->|"Emits"| BUNDLE
  end

  classDef groupCanvas fill:white,stroke:none
  class SG_CANVAS groupCanvas
```

See the [layer check](../scripts/check-layers.mjs) and [build script](../scripts/build.mjs).

## Map and workspace model

A workspace supplies one active personal map. Suns contain planets. A destination planet opens a website or an RDP connection. A group planet organizes its moons, which are destinations. A map can also carry routines and RDP presets. Visible team suns appear alongside the personal suns at runtime and stay out of saved personal maps.

```mermaid
---
config:
  # Keep class boxes and relationships readable on light or dark pages.
  theme: base
  # Give cardinalities an opaque background on dark pages.
  themeCSS: ".edgeTerminals .edgeLabel p { background-color: white; color: midnightblue; }"
  themeVariables:
    # Provide opaque class fills and visible connectors.
    primaryColor: "#eef2ff"
    primaryTextColor: "#172033"
    lineColor: "#7b8597"
---
%% Show the validated map shape and its workspace context.
classDiagram
  class WORKSPACE["Workspace"]
  class PERSONAL_MAP["Personal map"]
  class SUN["Sun"]
  class PLANET["Planet"]
  class DESTINATION_PLANET["Destination planet"]
  class GROUP_PLANET["Group planet"]
  class MOON["Moon"]
  class ROUTINE["Routine"]
  class RDP_PRESET["RDP preset"]

  WORKSPACE --> "1" PERSONAL_MAP : active map
  PERSONAL_MAP *-- "0..*" SUN
  PERSONAL_MAP *-- "0..*" ROUTINE
  PERSONAL_MAP *-- "0..*" RDP_PRESET
  SUN *-- "0..*" PLANET
  PLANET <|-- DESTINATION_PLANET
  PLANET <|-- GROUP_PLANET
  PLANET *-- "0..*" MOON
```

See the [validated map types](../src/core/types.js), [schema](../src/core/schema.js), and [workspace metadata](../src/state/workspaces.js).

## Startup and map selection

Direct launch uses the generated JavaScript data. Served launch reads `links.json` for Main and uses the generated workspace list to discover default workspaces, preferring each workspace's JSON when it can be fetched. The team source is independent. Served mode tries `/team.json` before the generated team data, and a team load error leaves personal startup available. Generate the bundled data with `python3 sync.py` after editing project map files.

```mermaid
---
config:
  # Use the native sequence renderer and a light message region.
  theme: base
  themeVariables:
    # Keep actor boxes opaque and lifelines visible.
    actorBkg: "#eef2ff"
    actorTextColor: "#172033"
    actorLineColor: "#7b8597"
    signalColor: "#475569"
    signalTextColor: "#172033"
    labelBoxBorderColor: "#7b8597"
---
%% Show startup order, workspace precedence, and failure paths.
sequenceDiagram
  participant START as Startup
  participant SOURCES as Map sources
  participant STORE as Map store
  participant STORAGE as Browser storage

  rect rgb(255, 255, 255)
    START->>SOURCES: Load and validate Main default
    alt Main default fails
      SOURCES-->>START: Load error
      START->>START: Show startup error
    else Main default loads
      SOURCES-->>START: Main default
      START->>SOURCES: Load team data and default workspaces
      SOURCES-->>START: Valid data and any team error
      START->>STORE: Start with loaded maps
      STORE->>STORAGE: Read active workspace and saved map
      alt Valid saved map
        STORAGE-->>STORE: Use saved map
      else Saved map missing or unreadable
        STORE->>STORE: Select workspace default or empty map
      end
      STORE->>STORE: Add visible team suns to the view
      STORE-->>START: Notify subscribers to render
    end
  end
```

An unreadable saved map produces a warning. Without a valid saved map, the store uses Main's default for Main, a matching bundled default for another default workspace, or an empty map when the workspace has no bundled default. See the [source loaders](../src/services/sources.js), [startup](../src/app/start.js), [map store](../src/state/store.js), and [data generator](../sync.py).

## Saving a map edit

The page's map store owns writes. It validates the personal map and saves it under the active workspace's browser storage key. When appropriate, it records the previous personal map in history and updates the backup reminder count. The page receives the updated view through a store subscription.

```mermaid
---
config:
  # Use the native sequence renderer and a light message region.
  theme: base
  themeVariables:
    # Keep actor boxes opaque and lifelines visible.
    actorBkg: "#eef2ff"
    actorTextColor: "#172033"
    actorLineColor: "#7b8597"
    signalColor: "#475569"
    signalTextColor: "#172033"
    labelBoxBorderColor: "#7b8597"
---
%% Show a normal editor save and the error return before publication.
sequenceDiagram
  participant EDITOR as Editor
  participant STORE as Map store
  participant STORAGE as Browser storage
  participant PAGE as Page subscriber

  rect rgb(255, 255, 255)
    EDITOR->>STORE: Save edited map
    STORE->>STORE: Keep personal suns and validate
    alt Edit is rejected
      STORE-->>EDITOR: Return save error
    else Edit is valid
      STORE->>STORAGE: Write workspace map
      alt Storage write fails
        STORAGE-->>STORE: Storage error
        STORE-->>EDITOR: Return save error
      else Map saved
        opt Eligible change
          STORE->>STORAGE: Record previous map in history
        end
        STORE->>STORE: Update map state and revision
        STORE-->>PAGE: Notify subscriber to redraw
      end
    end
  end
```

The store preserves unreadable raw map data before replacing it. Optional removal undo records have their own save and recovery handling. See the [page store](../src/state/page-store.js), [save implementation](../src/state/store.js), and [store tests](../src/state/store.test.js).

## Interaction state

**Diagram pending.** Show the four concurrent parts of Orbit's interaction state: overlay, edit and drag mode, current view, and Quick Find. Include Escape precedence and the events that cancel a drag. See the [mode reducer](../src/ui/modes.js) and [mode tests](../src/ui/modes.test.js).
