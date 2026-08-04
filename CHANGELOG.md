

## [1.3.0](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.5...1.3.0) (2026-08-04)


### Features

* add built-in official metaschemas ([a917139](https://github.com/Masquerade-Circus/schema-shield/commit/a9171392c9d693f5ee640a7f9c5f3244635557f6))
* add stack-safe deep validation ([929bcd3](https://github.com/Masquerade-Circus/schema-shield/commit/929bcd3b9ee1581592fa6259fb2863dafc87c6d2))


### Performance Improvements

* optimize schema compilation and validation ([41d7623](https://github.com/Masquerade-Circus/schema-shield/commit/41d762324eeaa7162952bb32b5aa893819169033))


### Build System

* change build strategy to use only bun ([e284ae1](https://github.com/Masquerade-Circus/schema-shield/commit/e284ae109242ba512741899ab5dfba2b47b3ca59))


### Documentation

* save production rebuild plan ([97b6c70](https://github.com/Masquerade-Circus/schema-shield/commit/97b6c70167a3ef2abd8b162a64c3c71f4b5eae50))

## [1.2.0](https://github.com/Masquerade-Circus/schema-shield/compare/1.1.0...1.2.0) (2026-07-30)


### Features

* add static schema registry ([6f9c0c5](https://github.com/Masquerade-Circus/schema-shield/commit/6f9c0c5e1dd99e6693af5217fc2866f98c69d301))
* expand JSON Schema draft support ([95899a3](https://github.com/Masquerade-Circus/schema-shield/commit/95899a3f4d9f4685870d33f2aeb05e15969c67d5))


### Tests

* consolidate compile limit regression ([23a32ee](https://github.com/Masquerade-Circus/schema-shield/commit/23a32ee4015ffc6ae84f3927de7f1002ef2658a2))

## [1.1.0](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.5...1.1.0) (2026-07-26)


### Features

* add configurable defaults and modernize builds ([2224d9a](https://github.com/Masquerade-Circus/schema-shield/commit/2224d9a1e8f051528a8296f1d60290cef85ad81a))
* rebuild validation with selective depth guards ([e4eb59c](https://github.com/Masquerade-Circus/schema-shield/commit/e4eb59cb0fc805e666ebcfed4a13e037202f2cae))


### Bug Fixes

* support Unicode lengths and local schema identifiers ([2e46326](https://github.com/Masquerade-Circus/schema-shield/commit/2e4632648ebd26a6ef73e64537ca8ccd5df2ee3a))


### Documentation

* improve README for adoption ([651dc29](https://github.com/Masquerade-Circus/schema-shield/commit/651dc296db8afc26cc503187467a578b2772c21c))

### [1.0.5](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.4...1.0.5) (2026-03-02)


### Bug Fixes

* fix error when additionalProperties false,  getCause() throws cant get property of null ([ebb2db1](https://github.com/Masquerade-Circus/schema-shield/commit/ebb2db15a5bb7e4bfe8988d83e85da66f08506d8))


### Miscellaneous Chores

* add context7.json ([4524666](https://github.com/Masquerade-Circus/schema-shield/commit/4524666beb3d05e17a5f7b2b341d2660931f0e47))


### Documentation

* improve documentation ([4f46450](https://github.com/Masquerade-Circus/schema-shield/commit/4f464507220cc98344480b2f7844590d5da9e93c))

### [1.0.4](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.3...1.0.4) (2026-02-28)


### Documentation

* improve documentation about severless implementations ([be28d26](https://github.com/Masquerade-Circus/schema-shield/commit/be28d263b94463a63c6de0cb5a9f7ef17e7f64b4))

### [1.0.3](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.2...1.0.3) (2026-02-28)


### Documentation

* add acknowledgments to other libraries ([d834110](https://github.com/Masquerade-Circus/schema-shield/commit/d834110769a08171a5c508c12489f52a8d221616))

### [1.0.2](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.1...1.0.2) (2026-02-28)


### Documentation

* add Skill.md ([a392285](https://github.com/Masquerade-Circus/schema-shield/commit/a392285fdeffd4eec9d7608b6d5698f85ad2612b))

### [1.0.1](https://github.com/Masquerade-Circus/schema-shield/compare/1.0.0...1.0.1) (2026-02-28)


### Performance Improvements

* improve performance ([ccf73b4](https://github.com/Masquerade-Circus/schema-shield/commit/ccf73b465983d173b153be2bd3d772197599a239))
* improve performance ([2896efe](https://github.com/Masquerade-Circus/schema-shield/commit/2896efea7cc465b472be0d272b464071ef8865af))
* increase performance ([0607805](https://github.com/Masquerade-Circus/schema-shield/commit/06078059a2d5764a9ab80c9e07175cea1bdbd67b))


### Code Refactoring

* just style refactor ([18da74d](https://github.com/Masquerade-Circus/schema-shield/commit/18da74db39d59b345206ce7b5273de2c48bea1c4))


### Documentation

* improve documentation ([f5aa971](https://github.com/Masquerade-Circus/schema-shield/commit/f5aa971e96c3e8d09b76dac095cb68956a3dd94d))

## [1.0.0](https://github.com/Masquerade-Circus/schema-shield/compare/0.0.6...1.0.0) (2025-11-29)


### ⚠ BREAKING CHANGES

* Change the way the result returns an error. If failFast is true error will be a
boolean.

### Features

* implement better loop stack and a failFast flag to improve performance ([7457ac6](https://github.com/Masquerade-Circus/schema-shield/commit/7457ac655215d51a0416c6dec984177d162374f3))

### [0.0.6](https://github.com/Masquerade-Circus/schema-shield/compare/0.0.5...0.0.6) (2023-05-13)


### Code Refactoring

* export ValidationError ([178d6e4](https://github.com/Masquerade-Circus/schema-shield/commit/178d6e4cb0745a6a3f0273330cc2d8f293613e12))

### [0.0.5](https://github.com/Masquerade-Circus/schema-shield/compare/0.0.4...0.0.5) (2023-04-01)


### Code Refactoring

* improve error handling ([#3](https://github.com/Masquerade-Circus/schema-shield/issues/3)) ([522d4c6](https://github.com/Masquerade-Circus/schema-shield/commit/522d4c68c847f04ad5c60356b9da11339d73d628))

### [0.0.4](https://github.com/Masquerade-Circus/schema-shield/compare/0.0.3...0.0.4) (2023-03-31)


### Documentation

* Update issue templates ([8c75c7e](https://github.com/Masquerade-Circus/schema-shield/commit/8c75c7e408092fa678537f050a0ef743433d90c5))


### Code Refactoring

* Improve performance ([#2](https://github.com/Masquerade-Circus/schema-shield/issues/2)) ([270aebc](https://github.com/Masquerade-Circus/schema-shield/commit/270aebc5a90b9f35b3622e9daef98735f849bbb9))

### [0.0.3](https://github.com/Masquerade-Circus/schema-shield/compare/0.0.2...0.0.3) (2023-03-29)


### Performance Improvements

* improve performance ([eb8f5f5](https://github.com/Masquerade-Circus/schema-shield/commit/eb8f5f57c4dc2f9856c9b02e24d9af9758ff551b))


### Code Refactoring

* add-more-formats-and-tests ([870d965](https://github.com/Masquerade-Circus/schema-shield/commit/870d96577b7fbefedf6313da9df39fd50b5f9d8f))
* handle-complex-draft4-compilation ([d2640e8](https://github.com/Masquerade-Circus/schema-shield/commit/d2640e8f00b89708fbf8df343664c40d3a3b7dc5))
* improve-main-library ([f1000f3](https://github.com/Masquerade-Circus/schema-shield/commit/f1000f3683b5bd98112f71149163a7a753e38e69))
* minor-updates ([5b6c30d](https://github.com/Masquerade-Circus/schema-shield/commit/5b6c30de8ba6a2da2020e9669162bd5307f6833a))

### 0.0.2 (2023-03-24)


### Documentation

* update module ([e21b0c0](https://github.com/Masquerade-Circus/schema-shield/commit/e21b0c040e9d8a7c8da4cc1ac91fcbef67b59da1))