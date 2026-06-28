import { Divider } from "@mantine/core";
import { ExampleTable } from "./ExampleTable";
import { ExampleTable2 } from "./ExampleTable2";
import { ExampleTable3 } from "./ExampleTable3";
import { ExampleTable4 } from "./ExampleTable4";

function App() {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ height: "100vh" }}>
        <ExampleTable />
      </div>
      <Divider />
      <div style={{ height: "100vh" }}>
        <ExampleTable2 />
      </div>
      <Divider />
      <div style={{ height: "100vh" }}>
        <ExampleTable3 />
      </div>
      <Divider />
      <div style={{ height: "100vh" }}>
        <ExampleTable4 />
      </div>
    </div>
  );
}

export default App;
