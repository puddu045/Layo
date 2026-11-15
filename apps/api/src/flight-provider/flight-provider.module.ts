import { Module } from '@nestjs/common';
import { loadApiEnv } from '@layo/config';
import { MockFlightProvider } from './mock-flight.provider';
import { AviationstackFlightProvider } from './aviationstack-flight.provider';
import { AeroDataBoxFlightProvider } from './aerodatabox-flight.provider';
import { AeroDataBoxQuotaService } from './aerodatabox-quota.service';
import { FLIGHT_PROVIDER } from './flight-provider.interface';

@Module({
  providers: [
    MockFlightProvider,
    AviationstackFlightProvider,
    AeroDataBoxFlightProvider,
    AeroDataBoxQuotaService,
    {
      provide: FLIGHT_PROVIDER,
      useFactory: (
        mock: MockFlightProvider,
        aviationstack: AviationstackFlightProvider,
        aerodatabox: AeroDataBoxFlightProvider,
      ) => {
        const env = loadApiEnv();
        if (env.FLIGHT_PROVIDER === 'aviationstack') return aviationstack;
        if (env.FLIGHT_PROVIDER === 'aerodatabox') return aerodatabox;
        return mock;
      },
      inject: [MockFlightProvider, AviationstackFlightProvider, AeroDataBoxFlightProvider],
    },
  ],
  exports: [FLIGHT_PROVIDER, AeroDataBoxQuotaService],
})
export class FlightProviderModule {}
