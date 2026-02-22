{
  description = "OpenSpecUI - Visual interface for spec-driven development";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forAllSystems = f: nixpkgs.lib.genAttrs supportedSystems (system: f system);
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          inherit (pkgs) lib;
        in
        {
          default = pkgs.stdenv.mkDerivation (finalAttrs: {
            pname = "openspecui";
            version = (builtins.fromJSON (builtins.readFile ./packages/cli/package.json)).version;

            src = lib.fileset.toSource {
              root = ./.;
              fileset = lib.fileset.unions [
                ./package.json
                ./pnpm-lock.yaml
                ./pnpm-workspace.yaml
                ./tsconfig.base.json
                ./packages/ai-provider
                ./packages/cli
                ./packages/core
                ./packages/search
                ./packages/server
                ./packages/web
                ./packages/xterm-input-panel
              ];
            };

            pnpmDeps = pkgs.fetchPnpmDeps {
              inherit (finalAttrs) pname version src;
              pnpm = pkgs.pnpm_10;
              fetcherVersion = 3;
              hash = "sha256-PiGbK2qQm5LsKuYnJV4bJdjPJSCO0fcxzufyoob7zlA=";
            };

            nativeBuildInputs = with pkgs; [
              nodejs_24
              npmHooks.npmInstallHook
              pnpmConfigHook
              pnpm_10
              python3
              pkg-config
            ];

            buildPhase = ''
              runHook preBuild
              pnpm run build
              runHook postBuild
            '';

            installPhase = ''
              runHook preInstall

              mkdir -p $out/lib
              mv node_modules $out/lib/
              mv packages $out/lib/

              mkdir -p $out/bin
              cat > $out/bin/openspecui <<'EOF'
#!${pkgs.runtimeShell}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec ${pkgs.nodejs_24}/bin/node "$SCRIPT_DIR/../lib/packages/cli/dist/cli.mjs" "$@"
EOF
              chmod +x $out/bin/openspecui

              runHook postInstall
            '';

            dontNpmBuild = true;
            dontNpmPrune = true;
            dontStrip = true;
            dontPatchShebangs = true;
            strictDeps = true;

            meta = with pkgs.lib; {
              description = "Visual interface for spec-driven development";
              homepage = "https://github.com/jixoai/openspecui";
              license = licenses.mit;
              maintainers = [ ];
              mainProgram = "openspecui";
            };
          });
        }
      );

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/openspecui";
        };
        openspecui = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/openspecui";
        };
      });

      checks = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          openspecui = self.packages.${system}.default;
        in
        {
          openspecui-version = pkgs.runCommand "openspecui-version-check" { nativeBuildInputs = [ openspecui ]; } ''
            openspecui --version >/dev/null
            touch $out
          '';
        }
      );

      devShells = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
        in
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_24
              pnpm_10
              bun
            ];

            shellHook = ''
              echo "OpenSpecUI development environment"
              echo "Node version: $(node --version)"
              echo "pnpm version: $(pnpm --version)"
              echo "bun version: $(bun --version)"
            '';
          };
        }
      );
    };
}
