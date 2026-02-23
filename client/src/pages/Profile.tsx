import DentistProfile from "@/components/DentistProfile";

export default function Profile() {
  return (
    <div className="space-y-6">
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
    </div>
  );
}
