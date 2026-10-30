import { Module } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import { MockFlightProvider } from './mock-flight.provider';
import { AviationstackFlightProvider } from './aviationstack-flight.provider';
import { FLIGHT_PROVIDER } from './flight-provider.interface';

@Module({
  providers: [
    MockFlightProvider,
    AviationstackFlightProvider,
    {
      provide: FLIGHT_PROVIDER,
      useFactory: (mock: MockFlightProvider, aviationstack: AviationstackFlightProvider) => {
        const env = loadApiEnv();
        return env.FLIGHT_PROVIDER === 'aviationstack' ? aviationstack : mock;
      },
      inject: [MockFlightProvider, AviationstackFlightProvider],
    },
  ],
  exports: [FLIGHT_PROVIDER],
})
export class FlightProviderModule {}
