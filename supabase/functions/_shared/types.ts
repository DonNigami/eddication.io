// ============================================
// SHARED TYPE DEFINITIONS
// ============================================

export interface JobStop {
  id: number;
  seq: number;
  reference: string;
  ship_to_code: string;
  ship_to_name: string;
  status: string;
  checkin_time?: string;
  checkout_time?: string;
  fueling_time?: string;
  unload_done_time?: string;
  is_origin_stop: boolean;
  dest_lat?: number;
  dest_lng?: number;
  total_qty?: number;
  materials?: string;
  checkin_lat?: number;
  checkin_lng?: number;
  checkout_lat?: number;
  checkout_lng?: number;
  odo_start?: number;
  receiver_name?: string;
  receiver_type?: string;
  has_pumping?: boolean;
  has_transfer?: boolean;
  vehicle_desc?: string;
  shipment_no?: string;
  drivers?: string;
  job_closed?: boolean;
  trip_ended?: boolean;
  end_odo?: number;
  end_point_name?: string;
  end_lat?: number;
  end_lng?: number;
  vehicle_status?: string;
  closed_at?: string;
  closed_by?: string;
  ended_at?: string;
  ended_by?: string;
  updated_at?: string;
  updated_by?: string;
  created_at?: string;
}

export interface AlcoholCheck {
  id?: number;
  reference: string;
  driver_name: string;
  alcohol_value: number;
  image_url?: string;
  lat?: number;
  lng?: number;
  user_id: string;
  created_at: string;
}

export interface SearchJobRequest {
  reference: string;
  userId: string;
}

export interface UpdateStopRequest {
  rowIndex: number;
  status: string;
  type: 'checkin' | 'checkout' | 'fuel' | 'unload';
  userId: string;
  lat?: number;
  lng?: number;
  odo?: number;
  receiverName?: string;
  receiverType?: string;
  hasPumping?: string;
  hasTransfer?: string;
}

export interface UploadAlcoholRequest {
  reference: string;
  driverName: string;
  userId: string;
  alcoholValue: number;
  imageBase64?: string;
  lat?: number;
  lng?: number;
}

export interface CloseJobRequest {
  reference: string;
  userId: string;
  vehicleStatus: string;
  vehicleDesc: string;
  hillFee: string;
  bkkFee: string;
  repairFee: string;
}

export interface EndTripRequest {
  reference: string;
  userId: string;
  endOdo?: number;
  endPointName: string;
  lat?: number;
  lng?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface JobData {
  referenceNo: string;
  vehicleDesc: string;
  shipmentNos: string[];
  totalStops: number;
  stops: StopInfo[];
  alcohol: {
    drivers: string[];
    checkedDrivers: string[];
  };
  jobClosed: boolean;
  tripEnded: boolean;
}

export interface StopInfo {
  rowIndex: number;
  seq: number;
  shipToCode: string;
  shipToName: string;
  status: string;
  checkInTime?: string;
  checkOutTime?: string;
  fuelingTime?: string;
  unloadDoneTime?: string;
  isOriginStop: boolean;
  destLat?: number;
  destLng?: number;
  totalQty?: number;
  materials?: string;
}
