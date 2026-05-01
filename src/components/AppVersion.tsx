/**
 * Mostra a versão do build no canto inferior direito.
 * Use para confirmar, no celular, se o deploy realmente subiu a versão nova.
 * Se sumir após algumas semanas estáveis, pode remover.
 */
export const AppVersion = () => {
  const version =
    typeof __BUILD_VERSION__ !== "undefined" ? __BUILD_VERSION__ : "dev";
  return (
    <div
      className="fixed bottom-1 right-2 z-[9999] text-[10px] leading-none text-muted-foreground/50 pointer-events-none select-none"
      aria-hidden
    >
      v{version}
    </div>
  );
};
