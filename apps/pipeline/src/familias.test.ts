import { describe, expect, it } from "vitest";
import { familiaDoModelo } from "./familias.ts";

describe("famílias de modelo", () => {
  it.each([
    ["HONDA/CG 160 FAN", "HONDA CG 160"],
    ["HONDA/CG 125 FAN KS", "HONDA CG 125"],
    ["HONDA/CB300F TWISTER ABS", "HONDA CB 300F"],
    ["HONDA/CB 300R", "HONDA CB 300R"],
    ["HONDA/CB 250F TWISTER", "HONDA CB 250F"],
    ["HONDA/NXR160 BROS ESDD", "HONDA NXR 160"],
    ["HONDA/NXR 160 BROS CBS", "HONDA NXR 160"],
    ["HONDA/PCX 160", "HONDA PCX 160"],
    ["HONDA/POP110I", "HONDA POP 110I"],
    ["HONDA/CG160START", "HONDA CG 160"],
    ["HONDA/CG160 START", "HONDA CG 160"],
    ["H/HONDA CG 125", "HONDA CG 125"],
    ["H/HONDA 150", "HONDA (MODELO NAO IDENTIFICADO)"],
    ["Y/YAMAHA XT 600", "YAMAHA XT 600"],
    ["YAMAHA/FZ25 FAZER", "YAMAHA FZ 25"],
    ["JTA/SUZUKI EN125 YES", "SUZUKI EN 125"],
    ["JTA/SUZUKIBOULEVARD M800", "SUZUKI BOULEVARD"],
    ["JTA-SUZUKI/GSR150I", "SUZUKI GSR 150I"],
    ["JTZ/DK150", "HAOJUE DK 150"],
    ["RE/HIMALAYAN", "ROYAL ENFIELD HIMALAYAN"],
    ["AVA/KAWASAKI NINJA 500", "KAWASAKI NINJA 500"],
    ["MOTTU/SPORT 110I", "MOTTU SPORT 110I"],
  ])("moto: %s → %s", (bruto, familia) => {
    expect(familiaDoModelo(bruto, "moto")).toBe(familia);
  });

  it.each([
    ["HYUNDAI/HB20 1.0M COMFOR", "HYUNDAI HB20"],
    ["HYUNDAI/HB20S 1.6A", "HYUNDAI HB20S"],
    ["I/HYUNDAI HB20 1.0 MT", "HYUNDAI HB20"],
    ["I/NISSAN KICKS SL CVT", "NISSAN KICKS"],
    ["IMP/GM CORSA WIND", "CHEVROLET CORSA"],
    ["GM/CORSA WIND", "CHEVROLET CORSA"],
    ["CHEV/ONIX 10MT LT1", "CHEVROLET ONIX"],
    ["CHEV/ONIX PLUS 10TAT LT1", "CHEVROLET ONIX PLUS"],
    ["CHEVROLET/ONIX 1.0", "CHEVROLET ONIX"],
    ["VW/NOVO GOL TL MCV", "VOLKSWAGEN GOL"],
    ["VW/VW FUSCA 1500", "VOLKSWAGEN FUSCA"],
    ["VW/T CROSS SENSE TSI AD", "VOLKSWAGEN T-CROSS"],
    ["VOLKSWAGEM/GOL 1.0", "VOLKSWAGEN GOL"],
    ["I/VW AMAROK CD", "VOLKSWAGEN AMAROK"],
    ["MMC/L200 TRITON", "MITSUBISHI L200"],
    ["I/M.BENZ C180", "MERCEDES-BENZ C180"],
    ["CAOACHERY/TIGGO 5X TXS", "CAOA CHERY TIGGO"],
    ["HONDA/HR V EXL", "HONDA HR-V"],
    ["PEUGEOT/207HB XR", "PEUGEOT 207"],
    ["I/PEUGEOT 2008 ALLURE", "PEUGEOT 2008"],
    ["I/M.BENZ 314CDISTREET C", "MERCEDES-BENZ SPRINTER"],
    ["M.BENZ/C180FF", "MERCEDES-BENZ C180"],
    ["M.BENZ/GLA200FF", "MERCEDES-BENZ GLA200"],
    ["M.BENZ/A 160", "MERCEDES-BENZ A160"],
    ["I/BMW 320I ACTIVE FLEX", "BMW 320"],
    ["FIAT/UNO 1.0", "FIAT UNO"],
    ["AUDI/1.8 T", "AUDI (MODELO NAO IDENTIFICADO)"],
    ["FIAT", "FIAT (MODELO NAO IDENTIFICADO)"],
    ["IMP/VOLKSWAGEN", "VOLKSWAGEN (MODELO NAO IDENTIFICADO)"],
  ])("carro: %s → %s", (bruto, familia) => {
    expect(familiaDoModelo(bruto, "carro")).toBe(familia);
  });

  it("vazio é não identificado", () => {
    expect(familiaDoModelo("", "carro")).toBe("NAO IDENTIFICADO");
    expect(familiaDoModelo("   ", "moto")).toBe("NAO IDENTIFICADO");
  });
});
