import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.warn("[Router] Rota não encontrada:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-accent flex items-center justify-center">
          <Compass className="w-8 h-8 text-accent-foreground" />
        </div>
        <h1 className="mb-2 text-4xl font-bold text-foreground">404</h1>
        <p className="mb-6 text-muted-foreground">
          A página que você tentou acessar não existe ou foi movida.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Voltar
          </Button>
          <Button onClick={() => navigate("/")}>
            Ir para o início
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
