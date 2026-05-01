import { Navigate } from "react-router-dom";

// Esta rota só é alcançada se o roteador definir `/index` em algum lugar.
// Mantemos como redirect para "/" para casar com o comportamento esperado.
const Index = () => <Navigate to="/" replace />;

export default Index;
