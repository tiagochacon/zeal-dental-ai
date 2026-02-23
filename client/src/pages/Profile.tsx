import { motion } from "framer-motion";
import DentistProfile from "@/components/DentistProfile";

export default function Profile() {
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div>
        <h1 className="text-xl lg:text-3xl font-bold">
          Meu Perfil Profissional
        </h1>
        <p className="text-sm text-muted-foreground hidden sm:block">
          Gerencie suas informações profissionais
        </p>
      </div>

      {/* Content */}
      <div className="max-w-2xl">
        <DentistProfile />
      </div>
    </motion.div>
  );
}
