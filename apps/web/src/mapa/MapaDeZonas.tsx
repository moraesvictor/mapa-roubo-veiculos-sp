import "maplibre-gl/dist/maplibre-gl.css";
import { CORES, ESCALA_DO_MAPA, niveisDaEscala, type RespostaGeometria, type RespostaZonas } from "@mapa/core";
import { AttributionControl, Map as MapaLibre, setWorkerUrl, type ExpressionSpecification, type LngLatBoundsLike } from "maplibre-gl";
import urlDoWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useRef, useState } from "react";
import { Icone } from "../icones/Icone.tsx";
import estilos from "./MapaDeZonas.module.css";

setWorkerUrl(urlDoWorker);

const ESTILO_BASE = "https://tiles.openfreemap.org/styles/positron";
function limitesDe(geometria: RespostaGeometria): LngLatBoundsLike {
  let [oeste, sul, leste, norte] = [180, 90, -180, -90];
  for (const f of geometria.features)
    for (const [lon, lat] of f.geometry.coordinates[0] ?? []) {
      oeste = Math.min(oeste, lon);
      leste = Math.max(leste, lon);
      sul = Math.min(sul, lat);
      norte = Math.max(norte, lat);
    }
  return [
    [oeste, sul],
    [leste, norte],
  ];
}

const folgas = (container: HTMLElement) =>
  container.clientWidth >= 700 ? { top: 80, bottom: 40, left: 40, right: 80 } : { top: 130, bottom: Math.round(container.clientHeight * 0.45), left: 16, right: 64 };

const corPorNivel = ["match", ["coalesce", ["feature-state", "nivel"], 0], ...ESCALA_DO_MAPA.flatMap((c, i) => [i, c]), ESCALA_DO_MAPA[0]] as unknown as ExpressionSpecification;

interface Props {
  geometria: RespostaGeometria;
  zonas: RespostaZonas | undefined;
  selecionada: string | null;
  aoSelecionar: (h3: string) => void;
}

function centroDe(geometria: RespostaGeometria, h3: string): [number, number] | null {
  const anel = geometria.features.find((f) => f.id === h3)?.geometry.coordinates[0];
  if (!anel?.length) return null;
  const [somaLon, somaLat] = anel.reduce(([a, b], [lon, lat]) => [a + lon, b + lat], [0, 0]);
  return [somaLon / anel.length, somaLat / anel.length];
}

export default function MapaDeZonas({ geometria, zonas, selecionada, aoSelecionar }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLibre | null>(null);
  const aoSelecionarRef = useRef(aoSelecionar);
  const [pronto, setPronto] = useState(false);
  const anteriores = useRef<string[]>([]);
  const selecaoAnterior = useRef<string | null>(null);

  useEffect(() => {
    aoSelecionarRef.current = aoSelecionar;
  }, [aoSelecionar]);

  useEffect(() => {
    if (!container.current) return;
    const mapa = new MapaLibre({
      container: container.current,
      style: ESTILO_BASE,
      bounds: limitesDe(geometria),
      fitBoundsOptions: { padding: folgas(container.current) },
      maxBounds: [
        [-47.3, -24.4],
        [-45.9, -23.0],
      ],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: false,
    });
    mapa.addControl(new AttributionControl({ compact: true }), "bottom-right");
    mapa.touchZoomRotate.disableRotation();
    mapaRef.current = mapa;

    mapa.once("load", () => {
      const primeiroRotulo = mapa.getStyle().layers.find((l) => l.type === "symbol")?.id;
      mapa.addSource("zonas", { type: "geojson", data: geometria, promoteId: "h3" });
      mapa.addLayer(
        {
          id: "areas",
          type: "fill",
          source: "zonas",
          paint: { "fill-color": corPorNivel, "fill-opacity": ["case", ["boolean", ["feature-state", "visivel"], false], 0.6, 0] },
        },
        primeiroRotulo,
      );
      mapa.addLayer(
        {
          id: "contorno-zona",
          type: "line",
          source: "zonas",
          paint: { "line-color": CORES["mapa-zona-contorno"], "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 12, 1.5, 14, 2.5], "line-opacity": ["case", ["boolean", ["feature-state", "zona"], false], 0.9, 0] },
        },
        primeiroRotulo,
      );
      mapa.addLayer({
        id: "selecao",
        type: "line",
        source: "zonas",
        paint: { "line-color": CORES["marca-principal"], "line-width": 4, "line-opacity": ["case", ["boolean", ["feature-state", "selecionada"], false], 1, 0] },
      });
      mapa.on("click", "areas", (evento) => {
        const id = evento.features?.[0]?.properties["h3"];
        if (typeof id === "string" && mapa.getFeatureState({ source: "zonas", id })["visivel"]) aoSelecionarRef.current(id);
      });
      mapa.on("mouseenter", "areas", () => (mapa.getCanvas().style.cursor = "pointer"));
      mapa.on("mouseleave", "areas", () => (mapa.getCanvas().style.cursor = ""));
      setPronto(true);
    });

    return () => {
      mapa.remove();
      mapaRef.current = null;
    };
  }, [geometria]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!pronto || !mapa || !zonas) return;
    for (const id of anteriores.current) mapa.setFeatureState({ source: "zonas", id }, { visivel: false, zona: false });
    const nivel = niveisDaEscala(zonas.celulas.map(([, n]) => n));
    for (const [id, n, zona] of zonas.celulas) mapa.setFeatureState({ source: "zonas", id }, { visivel: true, nivel: nivel(n), zona });
    anteriores.current = zonas.celulas.map(([id]) => id);
  }, [pronto, zonas]);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!pronto || !mapa) return;
    if (selecaoAnterior.current) mapa.setFeatureState({ source: "zonas", id: selecaoAnterior.current }, { selecionada: false });
    if (selecionada) {
      mapa.setFeatureState({ source: "zonas", id: selecionada }, { selecionada: true });
      const centro = centroDe(geometria, selecionada);
      if (centro && !mapa.getBounds().contains(centro)) mapa.easeTo({ center: centro, zoom: Math.max(mapa.getZoom(), 13) });
    }
    selecaoAnterior.current = selecionada;
  }, [pronto, selecionada, geometria]);

  const centralizar = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => mapaRef.current?.easeTo({ center: [coords.longitude, coords.latitude], zoom: 14 }),
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 10_000 },
    );
  };

  return (
    <div className={estilos.mapa}>
      <div
        ref={container}
        className={estilos.tela}
        role="img"
        aria-label="Mapa de São Paulo com as áreas de cerca de 1 km coloridas pela quantidade de ocorrências registradas. Os mesmos números estão na tabela."
      />
      <div className={estilos.controles}>
        <button type="button" className={estilos.controle} onClick={centralizar} aria-label="Centralizar na minha localização (fica só no seu aparelho)">
          <Icone nome="localizacao" />
        </button>
        <div className={estilos.zoom}>
          <button type="button" className={estilos.controle} onClick={() => mapaRef.current?.zoomIn()} aria-label="Aproximar">
            +
          </button>
          <button type="button" className={estilos.controle} onClick={() => mapaRef.current?.zoomOut()} aria-label="Afastar">
            −
          </button>
        </div>
      </div>
    </div>
  );
}
