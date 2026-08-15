"use client";

import { ChangeEvent, FormEvent, useMemo, useRef, useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { supabase } from "./components/lib/supabase";
import Login from "./components/login";

// Resto de tus imports...

type Scan = {
  id: number; codigoCaja: string; codigoEscaneado: string; descripcion: string;
  departamento: string; categoria: string; precio: number; ubicacion: string;
  usuario: string; hora: string;
};

type CatalogProduct = Omit<Scan, "id" | "codigoCaja" | "codigoEscaneado" | "ubicacion" | "usuario" | "hora"> & {
  caracteristicas?: string;
  existencia?: number;
};
type View = "dashboard" | "scanner" | "boxes" | "catalog" | "reports" | "settings";

type Profile = {
  id: string;
  nombre: string;
  role: string;
  activo: boolean;
};

const catalogoInicial: Record<string, CatalogProduct> = {};

const iniciales: Scan[] = [];

const Icon = ({ name }: { name: "grid" | "scan" | "boxes" | "catalog" | "report" | "settings" | "search" | "bell" | "chevron" | "download" | "box" | "check" }) => {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 12h8M9 9v6M12 9v6M15 9v6"/></>,
    boxes: <><path d="m4 8 8-4 8 4-8 4-8-4Z"/><path d="m4 8 8 4v8l-8-4V8ZM20 8l-8 4v8l8-4V8Z"/></>,
    catalog: <><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/><path d="M8 7h8M8 11h8M8 15h5"/></>,
    report: <><path d="M5 20V10M12 20V4M19 20v-7"/><path d="M3 20h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 2v3M12 19v3M2 12h3M19 12h3"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>, bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>, download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4"/><path d="M5 21h14"/></>,
    box: <><path d="M4 7.5 12 3l8 4.5V17l-8 4-8-4V7.5Z"/><path d="m4 7.5 8 4 8-4M12 11.5V21"/></>, check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
};

export default function Home() {
  const scannerRef = useRef<HTMLInputElement>(null);
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [procesandoEscaneo, setProcesandoEscaneo] = useState(false);
  const escaneoBloqueadoRef = useRef(false);  
  const [catalogo, setCatalogo] = useState<Record<string, CatalogProduct>>(catalogoInicial);
  const [catalogoNombre, setCatalogoNombre] = useState("Catálogo de prueba");
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [caja, setCaja] = useState("");
  const [cajaId, setCajaId] = useState<string | null>(null);
  const [ubicacionCaja, setUbicacionCaja] = useState("Zona de clasificación");
  const [codigo, setCodigo] = useState("");
  const [registros, setRegistros] = useState(iniciales);
  const [mensaje, setMensaje] = useState("Escanea una caja para comenzar");
  const [estadoEscaneo, setEstadoEscaneo] = useState<"info" | "success" | "error">("info");
  const [duplicadoPendiente, setDuplicadoPendiente] = useState<{
    codigo: string;
    producto: CatalogProduct;
    caja: string;
    claveCatalogo: string;
    cantidad: number;
  } | null>(null);

  useEffect(() => {
    async function consultarSesion() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUsuario(session?.user ?? null);
      setCargandoSesion(false);
    }

    consultarSesion();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      setUsuario(session?.user ?? null);
      setCargandoSesion(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!usuario) {
      setPerfil(null);
      setCatalogo(catalogoInicial);
      setRegistros(iniciales);
      setCaja("");
      setCajaId(null);
      return;
    }

    async function cargarDatosSupabase() {
      setCargandoDatos(true);
      setMensaje("Cargando información desde Supabase...");
      setEstadoEscaneo("info");

      try {
        const { data: perfilData, error: perfilError } = await supabase
          .from("profiles")
          .select("id,nombre,role,activo")
          .eq("id", usuario.id)
          .single();

        if (perfilError) throw perfilError;
        if (!perfilData.activo) {
          await supabase.auth.signOut();
          throw new Error("Tu usuario se encuentra desactivado");
        }
        setPerfil(perfilData as Profile);

        const catalogoCompleto: Record<string, CatalogProduct> = {};
        const tamanoPagina = 1000;
        let desde = 0;

        while (true) {
          const { data, error } = await supabase
            .from("catalogo")
            .select("clave,descripcion,caracteristicas,departamento,categoria,precio,existencia_sicarx")
            .range(desde, desde + tamanoPagina - 1);

          if (error) throw error;
          for (const producto of data ?? []) {
            catalogoCompleto[normalizarCodigo(producto.clave)] = {
              descripcion: producto.descripcion,
              caracteristicas: producto.caracteristicas,
              departamento: producto.departamento,
              categoria: producto.categoria,
              precio: Number(producto.precio) || 0,
              existencia: Number(producto.existencia_sicarx) || 0,
            };
          }
          if (!data || data.length < tamanoPagina) break;
          desde += tamanoPagina;
        }

        const { data: perfilesData } = await supabase
          .from("profiles")
          .select("id,nombre");
        const nombres = new Map((perfilesData ?? []).map(item => [item.id, item.nombre]));

        const { data: escaneosData, error: escaneosError } = await supabase
          .from("escaneos")
          .select("id,codigo_caja,codigo_escaneado,descripcion,departamento,categoria,precio,ubicacion,usuario_id,fecha_escaneo")
          .order("fecha_escaneo", { ascending: false })
          .limit(5000);

        if (escaneosError) throw escaneosError;

        const escaneos: Scan[] = (escaneosData ?? []).map(item => ({
          id: Number(item.id),
          codigoCaja: item.codigo_caja,
          codigoEscaneado: item.codigo_escaneado,
          descripcion: item.descripcion,
          departamento: item.departamento,
          categoria: item.categoria,
          precio: Number(item.precio) || 0,
          ubicacion: ubicacionCaja,
          usuario: nombres.get(item.usuario_id) ?? "Usuario",
          hora: new Date(item.fecha_escaneo).toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));

        setCatalogo(catalogoCompleto);
        setCatalogoNombre("Catálogo Supabase");
        setRegistros(escaneos);
        setMensaje(`Base cargada: ${Object.keys(catalogoCompleto).length.toLocaleString("es-MX")} productos y ${escaneos.length.toLocaleString("es-MX")} escaneos`);
        setEstadoEscaneo("success");
      } catch (error) {
        setMensaje(error instanceof Error ? error.message : "No se pudieron cargar los datos de Supabase");
        setEstadoEscaneo("error");
      } finally {
        setCargandoDatos(false);
        enfocarScanner();
      }
    }

    cargarDatosSupabase();
  }, [usuario]);

  const [busqueda, setBusqueda] = useState("");
  const [vista, setVista] = useState<View>("dashboard");
  const visibles = useMemo(() => registros.filter(r => `${r.codigoEscaneado} ${r.descripcion} ${r.codigoCaja}`.toLowerCase().includes(busqueda.toLowerCase())), [registros, busqueda]);
  const cajasResumen = useMemo(() => Array.from(new Set(registros.map(r => r.codigoCaja))).map(codigoCaja => {
    const productos = registros.filter(r => r.codigoCaja === codigoCaja);
    return { codigoCaja, productos: productos.length, ultimo: productos[0]?.hora ?? "—" };
  }), [registros]);
  const titulos: Record<View, [string,string,string]> = {
    dashboard:["RESUMEN GENERAL","Dashboard de inventario","Control y seguimiento de la operación en tiempo real."],
    scanner:["OPERACIÓN","Escanear cajas y productos","Captura continua con identificación automática de códigos."],
    boxes:["OPERACIÓN","Cajas registradas","Consulta las cajas procesadas y sus productos."],
    catalog:["GESTIÓN","Catálogo SICARX","Carga y consulta el catálogo para validar productos."],
    reports:["GESTIÓN","Reportes de inventario","Descarga la información capturada en Excel o JSON."],
    settings:["SISTEMA","Configuración","Parámetros generales de la operación."],
  };

  function normalizarEncabezado(valor: unknown) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
  }

  function normalizarCodigo(valor: unknown) {
    return String(valor ?? "")
      .replace(/[\u0000-\u001F\u007F-\u009F\u00A0]/g, "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
  }

  function enfocarScanner() {
    requestAnimationFrame(() => scannerRef.current?.focus());
  }

  async function agregarProducto(codigoProducto: string,producto: CatalogProduct, cajaDestino: string, claveCatalogo: string, confirmadoDuplicado = false) {
    if (!usuario || !cajaId) {
      setMensaje("No hay una sesión o caja válida para guardar el producto");
      setEstadoEscaneo("error");
      return false;
    }

    const { data, error } = await supabase
      .from("escaneos")
      .insert({
        caja_id: cajaId,
        codigo_caja: cajaDestino,
        codigo_escaneado: codigoProducto,
        clave_catalogo: claveCatalogo,
        descripcion: producto.descripcion,
        caracteristicas: producto.caracteristicas ?? "",
        departamento: producto.departamento,
        categoria: producto.categoria,
        precio: producto.precio,
        ubicacion: ubicacionCaja,
        usuario_id: usuario.id,
        posible_duplicado: confirmadoDuplicado,
        duplicado_confirmado: confirmadoDuplicado,
      })
      .select("id,fecha_escaneo")
      .single();

    if (error) {
      setMensaje(`No se pudo guardar el producto: ${error.message}`);
      setEstadoEscaneo("error");
      return false;
    }

    const fecha = new Date(data.fecha_escaneo);
    setRegistros(prev => [{
      id: Number(data.id),
      codigoCaja: cajaDestino,
      codigoEscaneado: codigoProducto,
      ...producto,
      ubicacion: ubicacionCaja,
      usuario: perfil?.nombre ?? usuario.email ?? "Usuario",
      hora: fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }),
    }, ...prev]);
    setMensaje(`${producto.descripcion} guardado en ${cajaDestino}`);
    setEstadoEscaneo("success");
    return true;
  }

  async function resolverDuplicado(agregar: boolean) {
    const pendiente = duplicadoPendiente;
    if (agregar && pendiente) {
      await agregarProducto(pendiente.codigo, pendiente.producto, pendiente.caja, pendiente.claveCatalogo, true);
    } else if (pendiente) {
      setMensaje(`Posible duplicado: ${pendiente.codigo} no fue agregado`);
      setEstadoEscaneo("error");
    }
    setDuplicadoPendiente(null);
    escaneoBloqueadoRef.current = false;
    setProcesandoEscaneo(false);
    setCodigo("");
    enfocarScanner();
  }

  async function cargarCatalogoExcel(event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    setCargandoCatalogo(true);
    setMensaje(`Leyendo ${archivo.name}...`);
    setEstadoEscaneo("info");

    try {
      const contenido = await archivo.arrayBuffer();
      const libro = XLSX.read(contenido, { type: "array", cellText: true });
      const nombreHoja = libro.SheetNames.find(nombre => normalizarEncabezado(nombre) === "plantilla") ?? libro.SheetNames[0];
      if (!nombreHoja) throw new Error("El archivo no contiene hojas");

      const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombreHoja], {
        header: 1,
        defval: "",
        raw: false,
      });
      if (filas.length < 2) throw new Error("La hoja no contiene productos");

      const encabezados = (filas[0] as unknown[]).map(normalizarEncabezado);
      const indice = (nombre: string) => encabezados.indexOf(nombre);
      const columnas = {
        clave: indice("clave"),
        descripcion: indice("descripcion"),
        caracteristicas: indice("caracteristicas"),
        departamento: indice("departamento"),
        categoria: indice("categoria"),
        precio: indice("precio1"),
        existencia: indice("existencia"),
      };

      const faltantes = Object.entries(columnas)
        .filter(([nombre, posicion]) => posicion < 0 && !["caracteristicas", "existencia"].includes(nombre))
        .map(([nombre]) => nombre);
      if (faltantes.length) throw new Error(`Faltan columnas obligatorias: ${faltantes.join(", ")}`);

      const nuevoCatalogo: Record<string, CatalogProduct> = {};
      let omitidos = 0;
      let duplicados = 0;

      for (const filaOriginal of filas.slice(1)) {
        const fila = filaOriginal as unknown[];
        const clave = normalizarCodigo(fila[columnas.clave]);
        if (!clave) { omitidos++; continue; }
        if (nuevoCatalogo[clave]) duplicados++;

        nuevoCatalogo[clave] = {
          descripcion: String(fila[columnas.descripcion] ?? "").trim(),
          caracteristicas: columnas.caracteristicas >= 0 ? String(fila[columnas.caracteristicas] ?? "").trim() : "",
          departamento: String(fila[columnas.departamento] ?? "").trim(),
          categoria: String(fila[columnas.categoria] ?? "").trim(),
          precio: Number(String(fila[columnas.precio] ?? "0").replace(/[$,]/g, "")) || 0,
          existencia: columnas.existencia >= 0 ? Number(fila[columnas.existencia]) || 0 : 0,
        };
      }

      const total = Object.keys(nuevoCatalogo).length;
      if (!total) throw new Error("No se encontraron claves válidas");

      if (!usuario) throw new Error("Debes iniciar sesión para guardar el catálogo");
      const productosSupabase = Object.entries(nuevoCatalogo).map(([clave, producto]) => ({
        clave,
        descripcion: producto.descripcion,
        caracteristicas: producto.caracteristicas ?? "",
        departamento: producto.departamento,
        categoria: producto.categoria,
        precio: producto.precio,
        existencia_sicarx: producto.existencia ?? 0,
        actualizado_por: usuario.id,
      }));

      const tamanoLote = 500;
      for (let inicio = 0; inicio < productosSupabase.length; inicio += tamanoLote) {
        setMensaje(`Guardando catálogo: ${Math.min(inicio + tamanoLote, total).toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")}`);
        const { error } = await supabase
          .from("catalogo")
          .upsert(productosSupabase.slice(inicio, inicio + tamanoLote), { onConflict: "clave" });
        if (error) throw error;
      }

      setCatalogo(nuevoCatalogo);
      setCatalogoNombre(archivo.name);
      setMensaje(`Catálogo cargado: ${total.toLocaleString("es-MX")} productos${duplicados ? ` · ${duplicados} claves duplicadas` : ""}${omitidos ? ` · ${omitidos} filas omitidas` : ""}`);
      setEstadoEscaneo("success");
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : "No se pudo leer el catálogo");
      setEstadoEscaneo("error");
    } finally {
      setCargandoCatalogo(false);
      enfocarScanner();
    }
  }

  // function esCodigoCaja(valor: string) {
  //   // Las cajas pueden tener guiones (ACC-HMBR1) o venir juntas (MEDICO4).
  //   // Deben ser alfanuméricas y contener al menos una letra y un número.
  //   return /^[A-Z0-9-]+$/.test(valor) && /[A-Z]/.test(valor) && /\d/.test(valor);
  // }

  function esCodigoCaja(valor: string) {
  // Las cajas siempre comienzan con una letra:
  // ACC-HMBR1, ACC-MUJR1, MEDICO4
  return /^[A-Z][A-Z0-9-]*\d[A-Z0-9-]*$/.test(valor);
}

  async function activarCaja(codigoCaja: string) {
    if (!usuario) {
      setMensaje("Debes iniciar sesión para registrar una caja");
      setEstadoEscaneo("error");
      return false;
    }

    const { data: existente, error: errorConsulta } = await supabase
      .from("cajas")
      .select("id,codigo,ubicacion")
      .eq("codigo", codigoCaja)
      .maybeSingle();

    if (errorConsulta) {
      setMensaje(`No se pudo consultar la caja: ${errorConsulta.message}`);
      setEstadoEscaneo("error");
      return false;
    }

    if (existente) {
      setCaja(existente.codigo);
      setCajaId(existente.id);
      setUbicacionCaja(existente.ubicacion);
      setMensaje(`Caja ${existente.codigo} activada. Ya puedes escanear productos`);
      setEstadoEscaneo("info");
      return true;
    }

    const { data: nueva, error: errorInsercion } = await supabase
      .from("cajas")
      .insert({
        codigo: codigoCaja,
        ubicacion: ubicacionCaja,
        estatus: "abierta",
        creada_por: usuario.id,
      })
      .select("id,codigo")
      .single();

    if (errorInsercion) {
      setMensaje(`No se pudo registrar la caja: ${errorInsercion.message}`);
      setEstadoEscaneo("error");
      return false;
    }

    setCaja(nueva.codigo);
    setCajaId(nueva.id);
    setMensaje(`Caja ${nueva.codigo} registrada y activada`);
    setEstadoEscaneo("success");
    return true;
  }

  async function escanear(e: FormEvent) {
    e.preventDefault();
    if (escaneoBloqueadoRef.current) {
      setCodigo("");
      return;
    }
    const original = normalizarCodigo(codigo);
    if (!original) return;
    escaneoBloqueadoRef.current = true;
    setProcesandoEscaneo(true);

    // Primero se busca como producto para no confundir productos
    // alfanuméricos del catálogo con códigos de caja.
    const base = /(?:AN|BN)$/.test(original) ? original.slice(0, -2) : original;
    const producto = catalogo[original] ?? catalogo[base];
    const claveValidada = catalogo[original] ? original : base;

    if (producto) {
      if (!caja) {
        setMensaje("Primero debes escanear el código de una caja");
        setEstadoEscaneo("error");
        setCodigo("");
        escaneoBloqueadoRef.current = false;
        setProcesandoEscaneo(false);
        enfocarScanner();
        return;
      }

      // Desde la segunda lectura del mismo producto en la caja activa,
      // se solicita confirmación para evitar duplicados accidentales.
      const cantidadEnCaja = registros.filter(registro => {
        if (registro.codigoCaja !== caja) return false;
        const codigoRegistrado = normalizarCodigo(registro.codigoEscaneado);
        const baseRegistrada = /(?:AN|BN)$/.test(codigoRegistrado)
          ? codigoRegistrado.slice(0, -2)
          : codigoRegistrado;
        const claveRegistrada = catalogo[codigoRegistrado]
          ? codigoRegistrado
          : baseRegistrada;
        return claveRegistrada === claveValidada;
      }).length;

      if (cantidadEnCaja >= 1) {
        escaneoBloqueadoRef.current = true;
        setDuplicadoPendiente({ codigo: original, producto, caja, claveCatalogo: claveValidada, cantidad: cantidadEnCaja });
        setMensaje(`Confirma si ${original} es otra pieza o un duplicado`);
        setEstadoEscaneo("info");
        setCodigo("");
        return;
      }

      await agregarProducto(original, producto, caja, claveValidada);
      setCodigo("");
      escaneoBloqueadoRef.current = false;
      setProcesandoEscaneo(false);
      enfocarScanner();
      return;
    }

    // Si no existe en el catálogo y es alfanumérico, se activa como caja.
    if (esCodigoCaja(original)) {
      await activarCaja(original);
      setCodigo("");
      escaneoBloqueadoRef.current = false;
      setProcesandoEscaneo(false);
      enfocarScanner();
      return;
    }

    setMensaje(`Código ${original} no reconocido como caja ni como producto`);
    setEstadoEscaneo("error");
    setCodigo("");
    escaneoBloqueadoRef.current = false;
    setProcesandoEscaneo(false);
    enfocarScanner();
  }

 function descargar(formato: "json" | "xlsx") {
  const datosExportacion = registros.map((registro) => ({
    codigoCaja: registro.codigoCaja,
    codigoEscaneado: registro.codigoEscaneado,
    descripcion: registro.descripcion,
    departamento: registro.departamento,
    categoria: registro.categoria,
    precio: registro.precio,
    ubicacion: registro.ubicacion || "",
    usuario: registro.usuario,
    hora: registro.hora,
  }));

  if (formato === "json") {
    const contenido = JSON.stringify(datosExportacion, null, 2);
    const url = URL.createObjectURL(
      new Blob([contenido], { type: "application/json" })
    );

    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "inventario.json";
    enlace.click();

    URL.revokeObjectURL(url);
    return;
  }

  const hoja = XLSX.utils.json_to_sheet(datosExportacion);

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Inventario");

  XLSX.writeFile(libro, "inventario.xlsx");
  }

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setMensaje(`No se pudo cerrar la sesión: ${error.message}`);
      setEstadoEscaneo("error");
      return;
    }

    setUsuario(null);
    setPerfil(null);
    setCaja("");
    setCajaId(null);
    setRegistros([]);
  }

  if (cargandoSesion) {
    return (
      <main className="login-page">
        <div className="login-logo">N</div>
      </main>
    );
  }

  if (!usuario) {
    return <Login onLogin={setUsuario} />;
  }

  const nombreUsuario =
    perfil?.nombre ||
    usuario?.email?.split("@")[0] ||
    "Usuario";

  const inicialesUsuario = nombreUsuario
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase())
    .join("");

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">N</div><div><strong>NOVENTIA</strong><span>CONTROL DE INVENTARIO</span></div></div>
      <nav><p>OPERACIÓN</p><button className={vista==="dashboard"?"active":""} onClick={()=>setVista("dashboard")}><Icon name="grid"/>Dashboard</button><button className={vista==="scanner"?"active":""} onClick={()=>setVista("scanner")}><Icon name="scan"/>Escanear productos</button><button className={vista==="boxes"?"active":""} onClick={()=>setVista("boxes")}><Icon name="boxes"/>Cajas</button><p>GESTIÓN</p><button className={vista==="catalog"?"active":""} onClick={()=>setVista("catalog")}><Icon name="catalog"/>Catálogo SICARX</button><button className={vista==="reports"?"active":""} onClick={()=>setVista("reports")}><Icon name="report"/>Reportes</button><p>SISTEMA</p><button className={vista==="settings"?"active":""} onClick={()=>setVista("settings")}><Icon name="settings"/>Configuración</button></nav>
      <div className="help-card"><div className="help-icon">?</div><strong>¿Necesitas ayuda?</strong><span>Consulta la guía de escaneo</span><button>Ver guía</button></div>
      <div className="profile">
        <div className="avatar">{inicialesUsuario}</div>

        <div>
          <strong>{nombreUsuario}</strong>
          <span>{perfil?.role || "Usuario"}</span>
        </div>

        <Icon name="chevron" />
          <button
    type="button"
    className="logout-button"
    onClick={cerrarSesion}
  >
    Salir
  </button>
      </div>
    </aside>
    <section className="workspace">
      <header><div className="mobile-brand">N</div><div className="header-search"><Icon name="search"/><input value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Buscar producto, caja o código..."/></div><button className="icon-button" aria-label="Notificaciones"><Icon name="bell"/><i/></button><div className="date-block"><span>Jueves, 13 de agosto</span><strong>10:32 AM</strong></div></header>
      <div className="content">
        <div className="title-row"><div><p className="eyebrow">{titulos[vista][0]}</p><h1>{titulos[vista][1]}</h1><p>{titulos[vista][2]}</p></div>{(vista==="dashboard"||vista==="reports")&&<div className="export"><button onClick={()=>descargar("xlsx")}><Icon name="download"/>Exportar Excel</button><button className="primary" onClick={()=>descargar("json")}><Icon name="download"/>Exportar JSON</button></div>}</div>
        {vista === "dashboard" && <div className="stats">
          <article><div className="stat-icon coral"><Icon name="catalog"/></div><div><span>PRODUCTOS ESCANEADOS</span><strong>{registros.length.toLocaleString("es-MX")}</strong><small className="positive">↗ 12.5% <i>vs. ayer</i></small></div></article>
          <article><div className="stat-icon blue"><Icon name="boxes"/></div><div><span>CAJAS PROCESADAS</span><strong>{new Set(registros.map(r=>r.codigoCaja)).size}</strong><small>Meta diaria: 24</small></div></article>
        </div>}
        {(vista === "dashboard" || vista === "scanner") && <div className={`operations-grid ${vista==="scanner"?"scanner-view":""}`}>
          <article className="scanner-card"><div className="card-heading"><div><p className="eyebrow">CAPTURA RÁPIDA</p><h2>Escaneo de inventario</h2></div><span className="live"><i/> EN LÍNEA</span></div>
            <div className="catalog-loader"><div><span>CATÁLOGO SICARX</span><strong>{catalogoNombre}</strong><small>{Object.keys(catalogo).length.toLocaleString("es-MX")} productos disponibles para validación</small></div><label className={cargandoCatalogo ? "loading" : ""}><Icon name="catalog"/>{cargandoCatalogo ? "Cargando..." : "Subir Excel"}<input type="file" accept=".xlsx,.xls" onChange={cargarCatalogoExcel} disabled={cargandoCatalogo}/></label></div>
            <div className={`active-box ${!caja ? "empty" : ""}`}><div className="box-glyph"><Icon name="box"/></div><div><span>CAJA ACTIVA</span><strong>{caja || "Esperando código de caja"}</strong><small>{caja ? "Los productos siguientes se agregarán aquí" : "Escanea una caja en el campo inferior"}</small></div></div>
            <div className="location-field">
              <label htmlFor="ubicacionCaja">UBICACIÓN DE LA CAJA</label>

              <input
                id="ubicacionCaja"
                type="text"
                value={ubicacionCaja}
                onChange={(e) => setUbicacionCaja(e.target.value)}
                placeholder="Ejemplo: PASILLO-A / RACK-03 / NIVEL-02"
              />
            </div>
            <form className="scan-form" onSubmit={escanear}>
              <label>ESCÁNER DE CAJAS Y PRODUCTOS</label>
              <div className="scan-input">
                <Icon name="scan"/>
                <input ref={scannerRef} autoFocus disabled={Boolean(duplicadoPendiente) || cargandoDatos || procesandoEscaneo} value={codigo} onChange={e=>setCodigo(e.target.value)} placeholder={cargandoDatos ? "Cargando base de datos..." : procesandoEscaneo ? "Guardando escaneo..." : duplicadoPendiente ? "Resuelve la alerta para continuar" : "Escanea una caja o un producto"}/>
                <span>ENTER</span>
              </div>
                <p>El sistema identificará automáticamente si el código pertenece a una caja o a un producto.</p>
                </form>
            <div className={`scan-status ${estadoEscaneo}`}><span><Icon name={estadoEscaneo === "info" ? "box" : "check"}/></span><div><strong>{mensaje}</strong><small>Caja activa: {caja || "ninguna"}</small></div></div>
          </article>
        </div>}
        {(vista === "dashboard" || vista === "scanner") && 
          <article className="recent-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">ACTIVIDAD RECIENTE</p>
                <h2>Últimos productos escaneados</h2>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>PRODUCTO</th>
                    <th>DEPARTAMENTO</th>
                    <th>CAJA</th>
                    <th>UBICACIÓN</th>
                    <th>PRECIO</th>
                    <th>HORA</th>
                    <th>ESTADO</th>
                  </tr>
                  </thead>
                  <tbody>{
                  visibles.slice(0,vista==="scanner"?20:6).map(r=><tr key={r.id}><td><code>{r.codigoEscaneado}</code></td>
                  <td><strong>{r.descripcion}</strong>
                  <span>{r.categoria}</span></td>
                  <td>{r.departamento}</td>
                  <td><span className="box-pill">{r.codigoCaja}</span></td>
                  <td>{r.ubicacion || "Sin ubicación"}</td>
                  <td>${r.precio.toFixed(2)}</td>
                  <td>{r.hora}</td>
                  <td><span className="status-pill"><i/>Encontrado</span></td></tr>
                )}</tbody></table></div></article>}
        {vista === "boxes" && <article className="section-card"><div className="card-heading"><div><p className="eyebrow">{cajasResumen.length} CAJAS</p><h2>Resumen por caja</h2></div></div><div className="boxes-grid">{cajasResumen.map(item=><button key={item.codigoCaja} className="box-summary" onClick={async()=>{await activarCaja(item.codigoCaja);setVista("scanner")}}><div className="box-glyph"><Icon name="box"/></div><div><strong>{item.codigoCaja}</strong><span>{item.productos} productos</span><small>Último registro: {item.ultimo}</small></div><Icon name="chevron"/></button>)}</div></article>}
        {vista === "catalog" && <article className="section-card"><div className="catalog-loader large"><div><span>CATÁLOGO ACTIVO</span><strong>{catalogoNombre}</strong><small>{Object.keys(catalogo).length.toLocaleString("es-MX")} productos disponibles</small></div><label><Icon name="catalog"/>Subir o actualizar Excel<input type="file" accept=".xlsx,.xls" onChange={cargarCatalogoExcel}/></label></div><div className="table-wrap catalog-table"><table><thead><tr><th>CLAVE</th><th>DESCRIPCIÓN</th><th>DEPARTAMENTO</th><th>CATEGORÍA</th><th>PRECIO</th></tr></thead><tbody>{Object.entries(catalogo).slice(0,100).map(([clave,p])=><tr key={clave}><td><code>{clave}</code></td><td><strong>{p.descripcion}</strong></td><td>{p.departamento}</td><td>{p.categoria}</td><td>${p.precio.toFixed(2)}</td></tr>)}</tbody></table></div><p className="section-note">Se muestran los primeros 100 productos.</p></article>}
        {vista === "reports" && <article className="section-card report-panel"><div className="report-icon"><Icon name="report"/></div><h2>Exportar inventario capturado</h2><p>{registros.length.toLocaleString("es-MX")} productos registrados en {cajasResumen.length} cajas.</p></article>}
        {vista === "settings" && <article className="section-card settings-panel">
          <h2>Parámetros actuales</h2>
          <div><span>Responsable</span>
          <strong> {nombreUsuario} </strong></div>
          <div>
            <span>Rol</span>
            <strong>{perfil?.role || "Usuario"}</strong>
          </div>
          <div>
            <span>Ubicación</span>
            <strong>Zona de clasificación</strong>
            </div><div><span>Alerta de duplicados</span><strong>Desde el segundo escaneo por caja</strong></div><div><span>Catálogo activo</span><strong>{catalogoNombre}</strong></div></article>}
      </div>
    </section>
    {duplicadoPendiente && <div className="duplicate-backdrop" role="dialog" aria-modal="true" aria-labelledby="duplicate-title">
      <div className="duplicate-modal">
        <div className="duplicate-icon">!</div>
        <p>POSIBLE PRODUCTO DUPLICADO</p>
        <h2 id="duplicate-title">¿Es otra pieza del producto?</h2>
        <strong>{duplicadoPendiente.producto.descripcion}</strong>
        <div className="duplicate-detail"><span>Código</span><b>{duplicadoPendiente.codigo}</b><span>Caja activa</span><b>{duplicadoPendiente.caja}</b><span>Registrados</span><b>{duplicadoPendiente.cantidad}</b></div>
        <small>El escáner permanecerá bloqueado hasta que selecciones una opción.</small>
        <div className="duplicate-actions"><button type="button" className="reject" onClick={()=>resolverDuplicado(false)}>Es duplicado, no agregar</button><button type="button" className="accept" onClick={()=>resolverDuplicado(true)}>Agregar otra pieza</button></div>
      </div>
    </div>}
  </main>;
}