import { validateCad } from "./model";
import { wallSolids } from "./geometry";
export function cadPythonSource(raw:unknown){
 const model=validateCad(raw),payload=Buffer.from(JSON.stringify({model,walls:wallSolids(model)})).toString("base64");
 return `# Roomwise editable CAD source. Generated from your saved room revision.
# Install/run: uvx --no-config --managed-python --python 3.13 --from cadgen==0.7.15 python room.py
# Outputs room.step beside this source. Units: millimetres, XY / +Z.
import base64, json, math
from cadgen import build123d as bd
from cadgen import step
DATA = json.loads(base64.b64decode("${payload}"))
MODEL = DATA["model"]

@step(out="room.step")
def room():
    parts = []
    floor = bd.extrude(bd.Polygon(*[(p["x"]*1000,p["y"]*1000) for p in MODEL["outline"]], align=None), amount=120).moved(bd.Location((0,0,-120)))
    floor.label = "Floor"
    parts.append(floor)
    for w in DATA["walls"]:
        a = MODEL["outline"][w["wall"]]
        b = MODEL["outline"][(w["wall"]+1)%len(MODEL["outline"])]
        angle = math.atan2(b["y"]-a["y"],b["x"]-a["x"])
        t = w["start"]+w["length"]/2
        shape = bd.Box(w["length"]*1000, MODEL["wallThickness"]*1000, w["height"]*1000)
        shape = shape.moved(bd.Location(((a["x"]+math.cos(angle)*t)*1000,(a["y"]+math.sin(angle)*t)*1000,(w["bottom"]+w["height"]/2)*1000),(0,0,math.degrees(angle))))
        shape.label = "Wall " + str(w["wall"]+1)
        parts.append(shape)
    for o in MODEL["openings"]:
        a = MODEL["outline"][o["wall"]]
        b = MODEL["outline"][(o["wall"]+1)%len(MODEL["outline"])]
        angle = math.atan2(b["y"]-a["y"],b["x"]-a["x"])
        t = o["offset"]+o["width"]/2
        shape = bd.Box(o["width"]*1000,35,o["height"]*1000).moved(bd.Location(((a["x"]+math.cos(angle)*t)*1000,(a["y"]+math.sin(angle)*t)*1000,(o["sill"]+o["height"]/2)*1000),(0,0,math.degrees(angle))))
        shape.label = o["kind"] + " " + o["id"]
        parts.append(shape)
    for f in MODEL["fixtures"]:
        if f["shape"] == "cylinder":
            # Elliptical profile for round/oval fixtures, exactly matching the web proxy.
            shape = bd.extrude(bd.Ellipse(f["width"]*500,f["depth"]*500), amount=f["height"]*1000).moved(bd.Location((0,0,-f["height"]*500)))
        else:
            shape = bd.Box(f["width"]*1000,f["depth"]*1000,f["height"]*1000)
        shape = shape.moved(bd.Location(((f["x"]+f["width"]/2)*1000,(f["y"]+f["depth"]/2)*1000,(f["z"]+f["height"]/2)*1000),(0,0,f["rotation"])))
        shape.label = f["label"]
        parts.append(shape)
    return bd.Compound(children=parts)

if __name__ == "__main__":
    room()
`;
}
