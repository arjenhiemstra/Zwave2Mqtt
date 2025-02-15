/* eslint-disable quotes */

// Place here repeated patterns
var FAN_DIMMER = {
  type: 'fan',
  object_id: 'dimmer',
  values: ['38-1-0'],
  discovery_payload: {
    command_topic: "38-1-0",
    speed_command_topic: "38-1-0",
    speed_state_topic: "38-1-0",
    state_topic: "38-1-0",
    speeds: ["off", "low", "medium", "high"],
    payload_low_speed: 24,
    payload_medium_speed: 50,
    payload_high_speed: 99,
    payload_off: 0,
    payload_on: 255,
    state_value_template: "{% if (value_json.value | int) == 0 %} 0 {% else %} 255 {% endif %}",
    speed_value_template: "{% if (value_json.value | int) == 0 %}  0  {% elif (value_json.value | int) <= 32 %}  24  {% elif (value_json.value | int) <= 66 %} 50 {% elif (value_json.value | int) <= 99 %} 99 {% endif %}"
  }
}

var COVER = {
  type: 'cover',
  object_id: 'position',
  values: ['38-1-0'],
  discovery_payload: {
    command_topic: "38-1-0",
    position_topic: "38-1-0",
    set_position_topic: "38-1-0",
    value_template: "{{ (value_json.value / 99 * 100) | round(0) }}",
    position_open: 99,
    position_closed: 0,
    payload_open: "99",
    payload_close: "0"
  }
}

module.exports = {
  '411-1-1': [
    { // Heatit Thermostat TF 021 (ThermoFloor AS)
      type: 'climate',
      object_id: 'thermostat',
      values: ['64-1-0', '49-1-1', '67-1-1', '67-1-2'],
      mode_map: { 'off': 'Off', 'heat': 'Heat (Default)', 'cool': 'Cool' },
      setpoint_topic: { "Heat (Default)": '67-1-1', "Cool": '67-1-2' },
      default_setpoint: '67-1-1',
      discovery_payload: {
        min_temp: 15,
        max_temp: 30,
        modes: ['off', 'heat', 'cool'],
        mode_state_topic: '64-1-0',
        mode_command_topic: true,
        current_temperature_topic: '49-1-1',
        current_temperature_template: '{{ value_json.value }}',
        temperature_state_template: '{{ value_json.value }}',
        temperature_command_topic: true
      }
    }
  ],
  '328-1-3': [
    { // EUROtronic Spirit
      type: 'climate',
      object_id: 'thermostat',
      values: ['64-1-0', '49-1-1', '67-1-1', '67-1-11'],
      mode_map: { 'off': 'Off', 'heat': 'Heat', 'auto': 'Heat Eco' },
      setpoint_topic: { "Heat": '67-1-1', "Heat Eco": '67-1-11' },
      default_setpoint: '67-1-1',
      discovery_payload: {
        min_temp: 11,
        max_temp: 25,
        modes: ['off', 'heat', 'auto'],
        mode_state_topic: '64-1-0',
        mode_command_topic: true,
        current_temperature_topic: '49-1-1',
        current_temperature_template: '{{ value_json.value }}',
        temperature_state_template: '{{ value_json.value }}',
        temperature_command_topic: true
      }
    }
  ],  
  '99-12340-18756': [FAN_DIMMER], // GE 1724 Dimmer
  '99-12593-18756': [FAN_DIMMER] // GE 1724 Dimmer
}
