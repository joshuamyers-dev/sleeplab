{
  description = "SleepLab development environment (uv + Python 3.12 + Node 22)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor = system: import nixpkgs { inherit system; };

      devShellFor = pkgs:
        pkgs.mkShell {
          packages = with pkgs; [
            uv # Python package & environment manager
            python312 # matches CI Python version
            nodejs_22 # matches CI Node version
            ruff # lint/format (nixpkgs build runs on NixOS; PyPI wheel does not)
            gcc # build tools if a wheel needs compiling
            pkg-config
          ];

          # manylinux wheels (numpy, matplotlib, psycopg2-binary, pydantic-core)
          # dynamically link libstdc++/libgcc_s/zlib, which NixOS does not
          # expose in the default environment.
          LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
            pkgs.stdenv.cc.cc.lib
            pkgs.zlib
          ];

          shellHook = ''
            # Keep uv pinned to the interpreter used by CI (Python 3.12).
            export UV_PYTHON="3.12"
          '';
        };
    in
    {
      devShells = forAllSystems (system: {
        default = devShellFor (pkgsFor system);
      });

      formatter = forAllSystems (system: (pkgsFor system).nixfmt);
    };
}